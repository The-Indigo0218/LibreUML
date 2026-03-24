import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useProjectStore } from "../../../../store/project.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { getDataTypes, type SupportedLanguage } from "../../../../config/dataTypeRegistry";
import type {
  UmlClassData,
  UmlAttribute,
  UmlMethod,
  UmlEnumLiteral,
  visibility as Visibility,
} from "../../types/diagram.types";
import type {
  ClassNode,
  InterfaceNode,
  AbstractClassNode,
  EnumNode,
} from "../../../../core/domain/models";
import type { ClassDiagramMetadata } from "../../../../core/domain/workspace/diagram-file.types";
import { Plus, Trash2, ArrowUp, ArrowDown, Wand2, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

// ─── TypeCombobox ─────────────────────────────────────────────────────────────

interface TypeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  containerClassName?: string;
  inputClassName?: string;
}

function TypeCombobox({
  value,
  onChange,
  options,
  containerClassName = '',
  inputClassName = '',
}: TypeComboboxProps) {
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [userHasTyped, setUserHasTyped] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef(value);
  const isCommittingRef = useRef(false);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filteredOptions = useMemo(() => {
    if (!userHasTyped) return options;
    const q = inputValue.trim().toLowerCase();
    if (!q) return options;

    const genericIdx = q.indexOf('<');
    if (genericIdx > 0) {
      // Generic-aware matching: exact prefix first, then same-base-type generics, then raw base
      const baseQ = q.slice(0, genericIdx);
      const exact = options.filter((o) => o.toLowerCase().startsWith(q));
      const sameBase = options.filter((o) => {
        const ol = o.toLowerCase();
        return !exact.includes(o) && ol.startsWith(baseQ) && ol.includes('<');
      });
      const raw = options.filter(
        (o) => !exact.includes(o) && !sameBase.includes(o) && o.toLowerCase().includes(baseQ),
      );
      return [...exact, ...sameBase, ...raw];
    }

    const prefix = options.filter((o) => o.toLowerCase().startsWith(q));
    const rest = options.filter(
      (o) => !o.toLowerCase().startsWith(q) && o.toLowerCase().includes(q),
    );
    return [...prefix, ...rest];
  }, [inputValue, options, userHasTyped]);

  useEffect(() => {
    committedRef.current = value;
    if (!isOpen) setInputValue(value);
  }, [value, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const close = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setIsOpen(false);
    };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setActiveIndex(-1);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredOptions]);

  useEffect(() => {
    if (activeIndex >= 0 && isOpen) {
      itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen]);

  const openDropdown = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: rect.width });
    setUserHasTyped(false);
    setIsOpen(true);
  };

  const commit = (val: string) => {
    isCommittingRef.current = true;
    const trimmed = val.trim() || committedRef.current;
    committedRef.current = trimmed;
    onChange(trimmed);
    setInputValue(trimmed);
    setUserHasTyped(false);
    setIsOpen(false);
  };

  const handleBlur = () => {
    if (isCommittingRef.current) {
      isCommittingRef.current = false;
      return;
    }
    const typed = inputValue.trim();
    const toCommit = typed || committedRef.current;
    if (toCommit !== committedRef.current) {
      committedRef.current = toCommit;
      onChange(toCommit);
    }
    setInputValue(toCommit);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          openDropdown();
          setActiveIndex(0);
        } else {
          setActiveIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (!isOpen || filteredOptions.length === 0) {
          commit(inputValue);
          inputRef.current?.blur();
          break;
        }
        if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
          commit(filteredOptions[activeIndex]);
        } else {
          commit(inputValue);
        }
        inputRef.current?.blur();
        break;
      case 'Escape':
        setInputValue(committedRef.current);
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${containerClassName}`}>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          setUserHasTyped(true);
          setInputValue(e.target.value);
          if (!isOpen) openDropdown();
        }}
        onFocus={openDropdown}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={inputClassName}
      />
      {isOpen && filteredOptions.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              minWidth: Math.max(dropdownPos.width, 140),
              zIndex: 99999,
            }}
            onMouseDown={(e) => e.preventDefault()}
            className="bg-surface-secondary border border-surface-border rounded shadow-2xl overflow-y-auto max-h-60"
          >
            {filteredOptions.map((opt, index) => (
              <button
                key={opt}
                ref={(el) => { itemRefs.current[index] = el; }}
                type="button"
                onClick={() => {
                  commit(opt);
                  inputRef.current?.blur();
                }}
                className={`w-full text-left px-3 py-1 text-xs font-mono transition-colors ${
                  index === activeIndex
                    ? 'bg-blue-600/20 text-blue-300'
                    : opt === value
                      ? 'text-blue-400 bg-blue-500/10 hover:bg-surface-hover'
                      : 'text-text-primary hover:bg-surface-hover'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SSoTContext {
  elementNames: string[];
  availableTypeNames: string[];
  packageNames?: string[];
}

interface ClassEditorModalProps {
  isOpen: boolean;
  umlData: UmlClassData;
  onSave: (data: UmlClassData) => void;
  onClose: () => void;
  ssotContext?: SSoTContext;
}

const VISIBILITY_OPTIONS: Visibility[] = ['+', '-', '#', '~'];

type PackageableClassNode = ClassNode | InterfaceNode | AbstractClassNode | EnumNode;

function isPackageableNode(node: { type: string }): node is PackageableClassNode {
  return (
    node.type === 'CLASS' ||
    node.type === 'INTERFACE' ||
    node.type === 'ABSTRACT_CLASS' ||
    node.type === 'ENUM'
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClassEditorModal({
  isOpen,
  umlData,
  onSave,
  onClose,
  ssotContext,
}: ClassEditorModalProps) {
  const projectNodes = useProjectStore((state) => state.nodes);
  const nodes = useMemo(
    () => (ssotContext ? [] : Object.values(projectNodes)),
    [projectNodes, ssotContext],
  );

  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const getFile = useWorkspaceStore((s) => s.getFile);

  const packages = useMemo(() => {
    if (ssotContext)
      return (ssotContext.packageNames ?? []).map((name, i) => ({ id: String(i), name }));
    if (!activeFileId) return [];
    const file = getFile(activeFileId);
    if (!file) return [];

    const classMeta = file.metadata as ClassDiagramMetadata | undefined;
    const filePackages = classMeta?.packages ?? [];

    const nodePackages = new Set<string>();
    nodes.forEach((node) => {
      if (!isPackageableNode(node)) return;
      const pkg = node.package;
      if (pkg?.trim()) nodePackages.add(pkg);
    });

    const allPackageNames = new Set([
      ...filePackages.map((p) => p.name),
      ...Array.from(nodePackages),
    ]);

    return Array.from(allPackageNames)
      .sort()
      .map((name) => ({ id: name, name }));
  }, [activeFileId, getFile, nodes, ssotContext]);

  const { t } = useTranslation();

  const [typeContext, setTypeContext] = useState<SupportedLanguage>('uml');

  const availableTypes = useMemo(() => {
    const baseTypes = getDataTypes(typeContext);
    if (ssotContext) {
      return [...baseTypes, ...ssotContext.availableTypeNames];
    }
    const classTypes = nodes
      .filter((node): node is PackageableClassNode => isPackageableNode(node))
      .map((node) => node.name);
    return [...baseTypes, ...classTypes];
  }, [nodes, ssotContext, typeContext]);

  const [draft, setDraft] = useState<UmlClassData>(() => ({
    ...umlData,
    attributes:
      Array.isArray(umlData.attributes) && typeof umlData.attributes[0] === 'string'
        ? []
        : umlData.attributes || [],
    methods:
      Array.isArray(umlData.methods) && typeof umlData.methods[0] === 'string'
        ? []
        : umlData.methods?.map((m) => ({
            ...m,
            parameters: m.parameters || [],
          })) || [],
    literals: umlData.literals ?? [],
  }));

  const classNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft((prev) => {
      const updatedMethods = prev.methods.map((m) =>
        m.isConstructor ? { ...m, name: prev.label } : m,
      );
      return { ...prev, methods: updatedMethods };
    });
  }, [draft.label]);

  const handleClassNameChange = (newName: string) => {
    setDraft((prev) => ({ ...prev, label: newName }));
  };

  const addAttribute = () => {
    const newAttr: UmlAttribute = {
      id: crypto.randomUUID(),
      visibility: '-',
      name: 'newAttr',
      type: 'String',
      isArray: false,
    };
    setDraft((prev) => ({ ...prev, attributes: [...prev.attributes, newAttr] }));
  };

  const updateAttribute = (index: number, field: keyof UmlAttribute, value: string | boolean) => {
    const newAttrs = [...draft.attributes];
    newAttrs[index] = { ...newAttrs[index], [field]: value };
    setDraft((prev) => ({ ...prev, attributes: newAttrs }));
  };

  const removeAttribute = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      attributes: prev.attributes.filter((_, i) => i !== index),
    }));
  };

  const moveAttribute = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === draft.attributes.length - 1) return;
    const newAttrs = [...draft.attributes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newAttrs[index], newAttrs[targetIndex]] = [newAttrs[targetIndex], newAttrs[index]];
    setDraft((prev) => ({ ...prev, attributes: newAttrs }));
  };

  const addConstructor = (fromAttributes = false) => {
    const newConstructor: UmlMethod = {
      id: crypto.randomUUID(),
      visibility: '+',
      name: draft.label,
      returnType: 'void',
      isReturnArray: false,
      isConstructor: true,
      parameters: fromAttributes
        ? draft.attributes.map((attr) => ({
            name: attr.name,
            type: attr.type,
            isArray: attr.isArray,
          }))
        : [],
    };
    setDraft((prev) => ({ ...prev, methods: [newConstructor, ...prev.methods] }));
  };

  const addMethod = () => {
    const newMethod: UmlMethod = {
      id: crypto.randomUUID(),
      visibility: '+',
      name: 'newMethod',
      returnType: 'void',
      isReturnArray: false,
      parameters: [],
      isConstructor: false,
    };
    setDraft((prev) => ({ ...prev, methods: [...prev.methods, newMethod] }));
  };

  const updateMethod = (index: number, field: keyof UmlMethod, value: string | boolean) => {
    const newMethods = [...draft.methods];
    newMethods[index] = { ...newMethods[index], [field]: value };
    if (field === 'returnType' && value === 'void') newMethods[index].isReturnArray = false;
    setDraft((prev) => ({ ...prev, methods: newMethods }));
  };

  const removeMethod = (index: number) => {
    setDraft((prev) => ({ ...prev, methods: prev.methods.filter((_, i) => i !== index) }));
  };

  const moveMethod = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === draft.methods.length - 1) return;
    const newMethods = [...draft.methods];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newMethods[index], newMethods[targetIndex]] = [newMethods[targetIndex], newMethods[index]];
    setDraft((prev) => ({ ...prev, methods: newMethods }));
  };

  // ── Enum literal CRUD ──────────────────────────────────────────────────────

  const addLiteral = () => {
    const newLiteral: UmlEnumLiteral = {
      id: crypto.randomUUID(),
      name: `LITERAL_${(draft.literals?.length ?? 0) + 1}`,
      value: undefined,
    };
    setDraft((prev) => ({ ...prev, literals: [...(prev.literals ?? []), newLiteral] }));
  };

  const updateLiteral = (index: number, field: keyof UmlEnumLiteral, value: string) => {
    const next = [...(draft.literals ?? [])];
    next[index] = { ...next[index], [field]: value || undefined };
    setDraft((prev) => ({ ...prev, literals: next }));
  };

  const removeLiteral = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      literals: (prev.literals ?? []).filter((_, i) => i !== index),
    }));
  };

  const moveLiteral = (index: number, direction: 'up' | 'down') => {
    const arr = [...(draft.literals ?? [])];
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === arr.length - 1) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    setDraft((prev) => ({ ...prev, literals: arr }));
  };

  const addParameter = (methodIndex: number) => {
    const newMethods = [...draft.methods];
    newMethods[methodIndex].parameters.push({ name: 'param', type: 'String', isArray: false });
    setDraft((prev) => ({ ...prev, methods: newMethods }));
  };

  const updateParameter = (
    methodIndex: number,
    paramIndex: number,
    field: 'name' | 'type' | 'isArray',
    value: string | boolean,
  ) => {
    const newMethods = [...draft.methods];
    newMethods[methodIndex].parameters[paramIndex] = {
      ...newMethods[methodIndex].parameters[paramIndex],
      [field]: value,
    };
    setDraft((prev) => ({ ...prev, methods: newMethods }));
  };

  const removeParameter = (methodIndex: number, paramIndex: number) => {
    const newMethods = [...draft.methods];
    newMethods[methodIndex].parameters = newMethods[methodIndex].parameters.filter(
      (_, i) => i !== paramIndex,
    );
    setDraft((prev) => ({ ...prev, methods: newMethods }));
  };

  const isAutoGenerateDisabled =
    draft.attributes.length === 0 ||
    draft.methods.some((m) => {
      if (!m.isConstructor) return false;
      if (m.parameters.length !== draft.attributes.length) return false;
      return m.parameters.every(
        (p, i) =>
          p.name === draft.attributes[i].name &&
          p.type === draft.attributes[i].type &&
          p.isArray === draft.attributes[i].isArray,
      );
    });

  if (!isOpen) return null;

  const typeInputCls =
    'w-full bg-surface-primary border border-surface-border rounded px-2 py-1 text-xs text-uml-interface-border outline-none focus:border-blue-500/50 transition-colors font-mono';

  const paramTypeInputCls =
    'w-full bg-surface-primary border border-surface-border rounded px-1.5 py-0.5 text-[11px] text-uml-interface-border outline-none focus:border-blue-500/50 transition-colors font-mono';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm font-sans p-4">
      <div className="bg-surface-primary border border-surface-border p-6 rounded-xl shadow-2xl w-200 max-w-[95vw] text-text-primary max-h-[95vh] flex flex-col">
        <div className="shrink-0 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-uml-class-border">{t('modals.classEditor.title')}</span>
            {draft.label}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                {t('modals.classEditor.className')}
              </label>
              <input
                ref={classNameInputRef}
                className="w-full bg-surface-secondary border border-surface-border focus:border-uml-class-border rounded p-2 text-text-primary outline-none transition-colors"
                value={draft.label}
                onChange={(e) => handleClassNameChange(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                {t('modals.classEditor.package')}
              </label>
              <select
                className="w-full bg-surface-secondary border border-surface-border rounded p-2 text-text-primary focus:border-uml-class-border outline-none"
                value={draft.package || ''}
                onChange={(e) =>
                  setDraft({ ...draft, package: e.target.value || undefined })
                }
              >
                <option value="">{t('modals.classEditor.noPackage')}</option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.name}>
                    {pkg.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">

          {/* ── Enum Literals (only rendered for enum stereotype) ─────── */}
          {draft.stereotype === 'enum' && (
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                  Enum Constants / Literals
                </label>
                <button
                  onClick={addLiteral}
                  className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 bg-purple-400/10 px-2 py-1 rounded"
                >
                  <Plus className="w-3 h-3" /> Add Literal
                </button>
              </div>

              {(draft.literals ?? []).length === 0 && (
                <p className="text-xs text-text-muted italic px-1">
                  No literals yet. Click &quot;Add Literal&quot; to define enum constants.
                </p>
              )}

              <div className="space-y-2">
                {(draft.literals ?? []).map((lit, idx) => (
                  <div
                    key={lit.id}
                    className="flex items-center gap-3 bg-surface-secondary p-2 rounded border border-surface-border group transition-colors hover:border-purple-500/40"
                  >
                    {/* Literal name */}
                    <input
                      className="bg-transparent border-b border-transparent focus:border-purple-400 outline-none flex-1 min-w-0 text-sm font-mono uppercase tracking-wide"
                      placeholder="LITERAL_NAME"
                      value={lit.name}
                      onChange={(e) => updateLiteral(idx, 'name', e.target.value.toUpperCase())}
                    />
                    <span className="text-text-muted font-mono text-xs">=</span>
                    {/* Optional value */}
                    <input
                      className="bg-transparent border-b border-transparent focus:border-purple-400 outline-none w-20 text-sm font-mono text-purple-300"
                      placeholder="value"
                      value={lit.value ?? ''}
                      onChange={(e) => updateLiteral(idx, 'value', e.target.value)}
                    />
                    {/* Reorder / delete */}
                    <div className="flex items-center gap-1 border-l border-surface-border pl-3 ml-1">
                      <button
                        onClick={() => moveLiteral(idx, 'up')}
                        disabled={idx === 0}
                        className="text-text-muted hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveLiteral(idx, 'down')}
                        disabled={idx === (draft.literals ?? []).length - 1}
                        className="text-text-muted hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeLiteral(idx)}
                        className="text-red-400 hover:text-red-300 ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Attributes (only for non-enum stereotypes) ───────────── */}
          {draft.stereotype !== 'enum' && <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                {t('modals.classEditor.attributes')}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex items-center">
                  <select
                    value={typeContext}
                    onChange={(e) => setTypeContext(e.target.value as SupportedLanguage)}
                    className="appearance-none bg-surface-secondary border border-surface-border rounded pl-2 pr-6 py-0.5 text-[11px] font-medium text-text-primary outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
                  >
                    <option value="uml">UML Standard</option>
                    <option value="java">Java</option>
                    <option value="csharp" disabled>C# (Soon)</option>
                    <option value="cpp" disabled>C++ (Soon)</option>
                    <option value="python" disabled>Python (Soon)</option>
                    <option value="typescript" disabled>TypeScript (Soon)</option>
                  </select>
                  <ChevronDown className="absolute right-1.5 w-3 h-3 text-text-muted pointer-events-none" />
                </div>
                <button
                  onClick={addAttribute}
                  className="text-xs flex items-center gap-1 text-green-400 hover:text-green-300 bg-green-400/10 px-2 py-1 rounded"
                >
                  <Plus className="w-3 h-3" /> {t('modals.classEditor.add')}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {draft.attributes.map((attr, idx) => (
                <div key={attr.id}>
                  <div
                    className="flex items-center gap-3 bg-surface-secondary p-2 rounded border border-surface-border group transition-colors"
                  >
                    <select
                      className="bg-transparent text-uml-abstract-border font-mono outline-none cursor-pointer"
                      value={attr.visibility}
                      onChange={(e) => updateAttribute(idx, 'visibility', e.target.value)}
                    >
                      {VISIBILITY_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <input
                      className="bg-transparent border-b border-transparent focus:border-uml-class-border outline-none flex-1 min-w-0 text-sm transition-colors"
                      placeholder={t('modals.classEditor.placeholders.name')}
                      value={attr.name}
                      onChange={(e) => updateAttribute(idx, 'name', e.target.value)}
                    />
                    <span className="text-text-muted font-mono">:</span>
                    <TypeCombobox
                      value={attr.type}
                      onChange={(v) => updateAttribute(idx, 'type', v)}
                      options={availableTypes}
                      containerClassName="w-32"
                      inputClassName={typeInputCls}
                    />
                    <label className="flex items-center gap-1.5 cursor-pointer bg-surface-primary px-2 py-1 rounded border border-surface-border hover:border-uml-class-border transition-colors">
                      <input
                        type="checkbox"
                        checked={attr.isArray}
                        onChange={(e) => updateAttribute(idx, 'isArray', e.target.checked)}
                        className="accent-uml-class-border w-3 h-3"
                      />
                      <span className="text-xs font-mono text-text-muted">[]</span>
                    </label>
                    <div className="flex items-center gap-1 border-l border-surface-border pl-3 ml-1">
                      <button
                        onClick={() => moveAttribute(idx, 'up')}
                        disabled={idx === 0}
                        className="text-text-muted hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveAttribute(idx, 'down')}
                        disabled={idx === draft.attributes.length - 1}
                        className="text-text-muted hover:text-white disabled:opacity-30"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => removeAttribute(idx)}
                        className="text-red-400 hover:text-red-300 ml-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>}

          {/* ── Methods (only for non-enum stereotypes) ──────────────── */}
          {draft.stereotype !== 'enum' && <div className="flex flex-col pt-4 border-t border-surface-border">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                {t('modals.classEditor.constructorsAndMethods')}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => addConstructor(true)}
                  disabled={isAutoGenerateDisabled}
                  className={`text-xs flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                    isAutoGenerateDisabled
                      ? 'text-purple-400/50 bg-purple-400/5 border-purple-500/10 cursor-not-allowed'
                      : 'text-purple-400 hover:text-purple-300 bg-purple-400/10 border-purple-500/30'
                  }`}
                  title={
                    isAutoGenerateDisabled
                      ? t('modals.classEditor.autoGenerateDisabledTooltip')
                      : t('modals.classEditor.autoGenerateTooltip')
                  }
                >
                  <Wand2 className="w-3 h-3" /> {t('modals.classEditor.autoGenerate')}
                </button>
                <button
                  onClick={() => addConstructor(false)}
                  className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 bg-purple-400/10 px-2 py-1 rounded"
                >
                  <Plus className="w-3 h-3" /> {t('modals.classEditor.constructor')}
                </button>
                <button
                  onClick={addMethod}
                  className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 bg-blue-400/10 px-2 py-1 rounded ml-2"
                >
                  <Plus className="w-3 h-3" /> {t('modals.classEditor.add')}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {draft.methods.map((method, methodIdx) => (
                <div key={method.id}>
                  <div
                    className={`flex flex-col bg-surface-secondary rounded border overflow-hidden transition-colors ${
                      method.isConstructor ? 'border-purple-500/30' : 'border-surface-border'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-3 p-2 border-b border-surface-border/50 ${
                        method.isConstructor ? 'bg-purple-900/10' : 'bg-surface-secondary'
                      }`}
                    >
                      <select
                        className={`bg-transparent font-mono outline-none cursor-pointer ${
                          method.isConstructor ? 'text-purple-400' : 'text-uml-abstract-border'
                        }`}
                        value={method.visibility}
                        onChange={(e) => updateMethod(methodIdx, 'visibility', e.target.value)}
                      >
                        {VISIBILITY_OPTIONS.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>

                      <input
                        className={`bg-transparent border-b outline-none flex-1 min-w-0 text-sm font-medium transition-colors ${
                          method.isConstructor
                            ? 'opacity-60 cursor-not-allowed border-transparent'
                            : 'border-transparent focus:border-uml-class-border'
                        }`}
                        placeholder={t('modals.classEditor.placeholders.methodName')}
                        value={method.isConstructor ? draft.label : method.name}
                        disabled={method.isConstructor}
                        onChange={(e) => updateMethod(methodIdx, 'name', e.target.value)}
                      />

                      <span className="text-text-muted font-mono">():</span>

                      {method.isConstructor ? (
                        <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-purple-500/30 w-32 text-center">
                          &lt;&lt;create&gt;&gt;
                        </span>
                      ) : (
                        <>
                          <TypeCombobox
                            value={method.returnType}
                            onChange={(v) => updateMethod(methodIdx, 'returnType', v)}
                            options={availableTypes}
                            containerClassName="w-32"
                            inputClassName={typeInputCls}
                          />
                          <label
                            className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-colors ${
                              method.returnType === 'void'
                                ? 'opacity-40 cursor-not-allowed bg-surface-primary/50 border-surface-border/50'
                                : 'cursor-pointer bg-surface-primary border-surface-border hover:border-uml-class-border'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={method.returnType === 'void'}
                              checked={!!method.isReturnArray}
                              onChange={(e) =>
                                updateMethod(methodIdx, 'isReturnArray', e.target.checked)
                              }
                              className="accent-uml-class-border w-3 h-3 disabled:grayscale"
                            />
                            <span className="text-xs font-mono text-text-muted">[]</span>
                          </label>
                        </>
                      )}

                      <div className="flex items-center gap-1 border-l border-surface-border pl-3 ml-1">
                        <button
                          onClick={() => moveMethod(methodIdx, 'up')}
                          disabled={methodIdx === 0}
                          className="text-text-muted hover:text-white disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveMethod(methodIdx, 'down')}
                          disabled={methodIdx === draft.methods.length - 1}
                          className="text-text-muted hover:text-white disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeMethod(methodIdx)}
                          className="text-red-400 hover:text-red-300 ml-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="bg-black/20 p-3 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                          {t('modals.classEditor.parameters')}{' '}
                          {method.isConstructor && `(${t('modals.classEditor.constructor')})`}
                        </span>
                        <button
                          onClick={() => addParameter(methodIdx)}
                          className="text-[10px] flex items-center gap-1 text-blue-400/80 hover:text-blue-300"
                        >
                          <Plus className="w-3 h-3" /> {t('modals.classEditor.addParameter')}
                        </button>
                      </div>

                      {method.parameters?.length === 0 ? (
                        <span className="text-[10px] text-text-muted italic">
                          {t('modals.classEditor.noParameters')}
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {method.parameters?.map((param, paramIdx) => (
                            <div
                              key={paramIdx}
                              className="flex items-center gap-2 bg-surface-primary/50 px-2 py-1.5 rounded border border-surface-border/50"
                            >
                              <input
                                className="bg-transparent border-b border-transparent focus:border-uml-class-border outline-none flex-1 min-w-0 text-xs text-text-secondary"
                                placeholder={t('modals.classEditor.parameterNamePlaceholder')}
                                value={param.name}
                                onChange={(e) =>
                                  updateParameter(methodIdx, paramIdx, 'name', e.target.value)
                                }
                              />
                              <span className="text-text-muted text-xs font-mono">:</span>
                              <TypeCombobox
                                value={param.type}
                                onChange={(v) =>
                                  updateParameter(methodIdx, paramIdx, 'type', v)
                                }
                                options={availableTypes}
                                containerClassName="w-28"
                                inputClassName={paramTypeInputCls}
                              />
                              <label className="flex items-center gap-1 cursor-pointer bg-surface-primary px-1.5 py-0.5 rounded border border-surface-border hover:border-uml-class-border transition-colors">
                                <input
                                  type="checkbox"
                                  checked={!!param.isArray}
                                  onChange={(e) =>
                                    updateParameter(
                                      methodIdx,
                                      paramIdx,
                                      'isArray',
                                      e.target.checked,
                                    )
                                  }
                                  className="accent-uml-class-border w-2.5 h-2.5"
                                />
                                <span className="text-[10px] font-mono text-text-muted">[]</span>
                              </label>
                              <button
                                onClick={() => removeParameter(methodIdx, paramIdx)}
                                className="text-red-400/70 hover:text-red-400 ml-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>}
        </div>

        <div className="shrink-0 flex justify-end gap-3 pt-4 mt-4 border-t border-surface-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            {t('modals.classEditor.cancel')}
          </button>
          <button
            onClick={() => onSave(draft)}
            className="px-6 py-2 text-sm bg-uml-class-border text-white rounded font-medium hover:brightness-110 shadow-md transition-all active:scale-95"
          >
            {t('modals.classEditor.save')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
