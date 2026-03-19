import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useProjectStore } from "../../../../store/project.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import type {
  UmlClassData,
  UmlAttribute,
  UmlMethod,
  visibility as Visibility,
} from "../../types/diagram.types";
import type {
  ClassNode,
  InterfaceNode,
  AbstractClassNode,
  EnumNode,
} from "../../../../core/domain/models";
import type { ClassDiagramMetadata } from "../../../../core/domain/workspace/diagram-file.types";
import { Plus, Trash2, ArrowUp, ArrowDown, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useUiStore } from "../../../../store/uiStore";

interface SSoTContext {
  elementNames: string[];
  availableTypeNames: string[];
}

interface ClassEditorModalProps {
  isOpen: boolean;
  umlData: UmlClassData;
  onSave: (data: UmlClassData) => void;
  onClose: () => void;
  ssotContext?: SSoTContext;
}

const PRIMITIVE_TYPES = [
  "String",
  "int",
  "boolean",
  "void",
  "double",
  "float",
  "char",
  "Date",
];

const VISIBILITY_OPTIONS: Visibility[] = ["+", "-", "#", "~"];

type PackageableClassNode = ClassNode | InterfaceNode | AbstractClassNode | EnumNode;

function isPackageableNode(
  node: { type: string },
): node is PackageableClassNode {
  return (
    node.type === "CLASS" ||
    node.type === "INTERFACE" ||
    node.type === "ABSTRACT_CLASS" ||
    node.type === "ENUM"
  );
}

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
    if (ssotContext) return [];
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

  const editingId = useUiStore((state) => state.editingId);
  const { t } = useTranslation();

  const availableTypes = useMemo(() => {
    if (ssotContext) {
      return [...PRIMITIVE_TYPES, ...ssotContext.availableTypeNames];
    }
    const classTypes = nodes
      .filter(
        (node): node is PackageableClassNode => isPackageableNode(node),
      )
      .map((node) => node.name);
    return [...PRIMITIVE_TYPES, ...classTypes];
  }, [nodes, ssotContext]);

  const [draft, setDraft] = useState<UmlClassData>(() => ({
    ...umlData,
    attributes:
      Array.isArray(umlData.attributes) &&
      typeof umlData.attributes[0] === "string"
        ? []
        : umlData.attributes || [],
    methods:
      Array.isArray(umlData.methods) && typeof umlData.methods[0] === "string"
        ? []
        : umlData.methods?.map((m) => ({
            ...m,
            parameters: m.parameters || [],
          })) || [],
  }));

  const [classNameError, setClassNameError] = useState(false);
  const [attributeErrors, setAttributeErrors] = useState<Set<number>>(
    new Set(),
  );
  const [methodErrors, setMethodErrors] = useState<Set<number>>(new Set());
  const classNameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft((prev) => {
      const updatedMethods = prev.methods.map((m) =>
        m.isConstructor ? { ...m, name: prev.label } : m,
      );
      return { ...prev, methods: updatedMethods };
    });
  }, [draft.label]);

  const validateClassName = (name: string): boolean => {
    if (ssotContext) {
      return ssotContext.elementNames.some(
        (n) => n !== umlData.label && n === name,
      );
    }
    const currentPackage = draft.package ?? "";
    return nodes.some((node) => {
      if (node.id === editingId) return false;
      if (!isPackageableNode(node)) return false;
      return (
        node.name === name && (node.package ?? "") === currentPackage
      );
    });
  };

  const validateAttributeName = (
    name: string,
    currentIndex: number,
  ): boolean => {
    return draft.attributes.some(
      (attr, idx) => idx !== currentIndex && attr.name === name,
    );
  };

  const validateMethodSignature = (
    method: UmlMethod,
    currentIndex: number,
  ): boolean => {
    return draft.methods.some((m, idx) => {
      if (idx === currentIndex) return false;
      if (m.name !== method.name) return false;
      if (m.parameters.length !== method.parameters.length) return false;
      return m.parameters.every((p, i) => {
        const otherParam = method.parameters[i];
        return (
          p.type === otherParam.type &&
          (p.isArray || false) === (otherParam.isArray || false)
        );
      });
    });
  };

  const handleClassNameChange = (newName: string) => {
    if (validateClassName(newName)) {
      setClassNameError(true);
      setTimeout(() => {
        setDraft((prev) => ({ ...prev, label: umlData.label }));
        setClassNameError(false);
      }, 2000);
    } else {
      setDraft({ ...draft, label: newName });
    }
  };

  const addAttribute = () => {
    const newAttr: UmlAttribute = {
      id: crypto.randomUUID(),
      visibility: "-",
      name: "newAttr",
      type: "String",
      isArray: false,
    };
    setDraft((prev) => ({ ...prev, attributes: [...prev.attributes, newAttr] }));
  };

  const updateAttribute = (
    index: number,
    field: keyof UmlAttribute,
    value: string | boolean,
  ) => {
    if (field === "name" && typeof value === "string") {
      if (validateAttributeName(value, index)) {
        setAttributeErrors((prev) => new Set(prev).add(index));
        setTimeout(() => {
          setDraft((prev) => {
            const newAttrs = [...prev.attributes];
            newAttrs[index] = {
              ...newAttrs[index],
              name: prev.attributes[index].name,
            };
            return { ...prev, attributes: newAttrs };
          });
          setAttributeErrors((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        }, 2000);
        return;
      }
    }

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

  const moveAttribute = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === draft.attributes.length - 1) return;
    const newAttrs = [...draft.attributes];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newAttrs[index], newAttrs[targetIndex]] = [
      newAttrs[targetIndex],
      newAttrs[index],
    ];
    setDraft((prev) => ({ ...prev, attributes: newAttrs }));
  };

  const addConstructor = (fromAttributes: boolean = false) => {
    const newConstructor: UmlMethod = {
      id: crypto.randomUUID(),
      visibility: "+",
      name: draft.label,
      returnType: "void",
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
    setDraft((prev) => ({
      ...prev,
      methods: [newConstructor, ...prev.methods],
    }));
  };

  const addMethod = () => {
    const newMethod: UmlMethod = {
      id: crypto.randomUUID(),
      visibility: "+",
      name: "newMethod",
      returnType: "void",
      isReturnArray: false,
      parameters: [],
      isConstructor: false,
    };
    setDraft((prev) => ({ ...prev, methods: [...prev.methods, newMethod] }));
  };

  const updateMethod = (
    index: number,
    field: keyof UmlMethod,
    value: string | boolean,
  ) => {
    const newMethods = [...draft.methods];
    newMethods[index] = { ...newMethods[index], [field]: value };
    if (field === "returnType" && value === "void")
      newMethods[index].isReturnArray = false;

    if (field === "name") {
      if (validateMethodSignature(newMethods[index], index)) {
        setMethodErrors((prev) => new Set(prev).add(index));
        setTimeout(() => {
          setDraft((prev) => {
            const revertMethods = [...prev.methods];
            revertMethods[index] = {
              ...revertMethods[index],
              name: prev.methods[index].name,
            };
            return { ...prev, methods: revertMethods };
          });
          setMethodErrors((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
          });
        }, 2000);
        return;
      }
    }

    setDraft((prev) => ({ ...prev, methods: newMethods }));
  };

  const removeMethod = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      methods: prev.methods.filter((_, i) => i !== index),
    }));
  };

  const moveMethod = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === draft.methods.length - 1) return;
    const newMethods = [...draft.methods];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newMethods[index], newMethods[targetIndex]] = [
      newMethods[targetIndex],
      newMethods[index],
    ];
    setDraft((prev) => ({ ...prev, methods: newMethods }));
  };

  const addParameter = (methodIndex: number) => {
    const newMethods = [...draft.methods];
    newMethods[methodIndex].parameters.push({
      name: "param",
      type: "String",
      isArray: false,
    });

    if (validateMethodSignature(newMethods[methodIndex], methodIndex)) {
      setMethodErrors((prev) => new Set(prev).add(methodIndex));
      setTimeout(() => {
        setMethodErrors((prev) => {
          const next = new Set(prev);
          next.delete(methodIndex);
          return next;
        });
      }, 2000);
      return;
    }

    setDraft((prev) => ({ ...prev, methods: newMethods }));
  };

  const updateParameter = (
    methodIndex: number,
    paramIndex: number,
    field: "name" | "type" | "isArray",
    value: string | boolean,
  ) => {
    const newMethods = [...draft.methods];
    newMethods[methodIndex].parameters[paramIndex] = {
      ...newMethods[methodIndex].parameters[paramIndex],
      [field]: value,
    };

    if (field === "type" || field === "isArray") {
      if (validateMethodSignature(newMethods[methodIndex], methodIndex)) {
        setMethodErrors((prev) => new Set(prev).add(methodIndex));
        setTimeout(() => {
          setDraft((prev) => {
            const revertMethods = [...prev.methods];
            revertMethods[methodIndex].parameters[paramIndex] = {
              ...prev.methods[methodIndex].parameters[paramIndex],
            };
            return { ...prev, methods: revertMethods };
          });
          setMethodErrors((prev) => {
            const next = new Set(prev);
            next.delete(methodIndex);
            return next;
          });
        }, 2000);
        return;
      }
    }

    setDraft((prev) => ({ ...prev, methods: newMethods }));
  };

  const removeParameter = (methodIndex: number, paramIndex: number) => {
    const newMethods = [...draft.methods];
    newMethods[methodIndex].parameters = newMethods[
      methodIndex
    ].parameters.filter((_, i) => i !== paramIndex);
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm font-sans p-4">
      <div className="bg-surface-primary border border-surface-border p-6 rounded-xl shadow-2xl w-200 max-w-[95vw] text-text-primary max-h-[95vh] flex flex-col">
        <div className="shrink-0 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="text-uml-class-border">
              {t("modals.classEditor.title")}
            </span>
            {draft.label}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                {t("modals.classEditor.className")}
              </label>
              <input
                ref={classNameInputRef}
                className={`w-full bg-surface-secondary border rounded p-2 text-text-primary outline-none transition-colors ${
                  classNameError
                    ? "border-red-500 text-red-500"
                    : "border-surface-border focus:border-uml-class-border"
                }`}
                value={draft.label}
                onChange={(e) => handleClassNameChange(e.target.value)}
              />
              {classNameError && (
                <p className="text-xs text-red-500 mt-1">
                  Class name already exists in this package
                </p>
              )}
            </div>

            {!ssotContext && (
              <div>
                <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                  {t("modals.classEditor.package")}
                </label>
                <select
                  className="w-full bg-surface-secondary border border-surface-border rounded p-2 text-text-primary focus:border-uml-class-border outline-none"
                  value={draft.package || ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      package: e.target.value || undefined,
                    })
                  }
                >
                  <option value="">{t("modals.classEditor.noPackage")}</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.name}>
                      {pkg.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                {t("modals.classEditor.attributes")}
              </label>
              <button
                onClick={addAttribute}
                className="text-xs flex items-center gap-1 text-green-400 hover:text-green-300 bg-green-400/10 px-2 py-1 rounded"
              >
                <Plus className="w-3 h-3" /> {t("modals.classEditor.add")}
              </button>
            </div>

            <div className="space-y-2">
              {draft.attributes.map((attr, idx) => (
                <div key={attr.id}>
                  <div
                    className={`flex items-center gap-3 bg-surface-secondary p-2 rounded border group transition-colors ${
                      attributeErrors.has(idx)
                        ? "border-red-500"
                        : "border-surface-border"
                    }`}
                  >
                    <select
                      className="bg-transparent text-uml-abstract-border font-mono outline-none cursor-pointer"
                      value={attr.visibility}
                      onChange={(e) =>
                        updateAttribute(idx, "visibility", e.target.value)
                      }
                    >
                      {VISIBILITY_OPTIONS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                    <input
                      className={`bg-transparent border-b outline-none flex-1 min-w-0 text-sm transition-colors ${
                        attributeErrors.has(idx)
                          ? "border-red-500 text-red-500"
                          : "border-transparent focus:border-uml-class-border"
                      }`}
                      placeholder={t("modals.classEditor.placeholders.name")}
                      value={attr.name}
                      onChange={(e) =>
                        updateAttribute(idx, "name", e.target.value)
                      }
                    />
                    <span className="text-text-muted font-mono">:</span>
                    <select
                      className="bg-surface-primary border border-surface-border rounded px-2 py-1 text-xs text-uml-interface-border outline-none w-32"
                      value={attr.type}
                      onChange={(e) =>
                        updateAttribute(idx, "type", e.target.value)
                      }
                    >
                      {availableTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1.5 cursor-pointer bg-surface-primary px-2 py-1 rounded border border-surface-border hover:border-uml-class-border transition-colors">
                      <input
                        type="checkbox"
                        checked={attr.isArray}
                        onChange={(e) =>
                          updateAttribute(idx, "isArray", e.target.checked)
                        }
                        className="accent-uml-class-border w-3 h-3"
                      />
                      <span className="text-xs font-mono text-text-muted">
                        []
                      </span>
                    </label>
                    <div className="flex items-center gap-1 border-l border-surface-border pl-3 ml-1">
                      <button
                        onClick={() => moveAttribute(idx, "up")}
                        disabled={idx === 0}
                        className="text-text-muted hover:text-white disabled:opacity-30"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveAttribute(idx, "down")}
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
                  {attributeErrors.has(idx) && (
                    <p className="text-xs text-red-500 mt-1 ml-2">
                      Attribute name already exists in this class
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col pt-4 border-t border-surface-border">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-bold text-text-secondary uppercase tracking-wider">
                {t("modals.classEditor.constructorsAndMethods")}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => addConstructor(true)}
                  disabled={isAutoGenerateDisabled}
                  className={`text-xs flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
                    isAutoGenerateDisabled
                      ? "text-purple-400/50 bg-purple-400/5 border-purple-500/10 cursor-not-allowed"
                      : "text-purple-400 hover:text-purple-300 bg-purple-400/10 border-purple-500/30"
                  }`}
                  title={
                    isAutoGenerateDisabled
                      ? t("modals.classEditor.autoGenerateDisabledTooltip")
                      : t("modals.classEditor.autoGenerateTooltip")
                  }
                >
                  <Wand2 className="w-3 h-3" />{" "}
                  {t("modals.classEditor.autoGenerate")}
                </button>
                <button
                  onClick={() => addConstructor(false)}
                  className="text-xs flex items-center gap-1 text-purple-400 hover:text-purple-300 bg-purple-400/10 px-2 py-1 rounded"
                >
                  <Plus className="w-3 h-3" />{" "}
                  {t("modals.classEditor.constructor")}
                </button>
                <button
                  onClick={addMethod}
                  className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 bg-blue-400/10 px-2 py-1 rounded ml-2"
                >
                  <Plus className="w-3 h-3" /> {t("modals.classEditor.add")}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {draft.methods.map((method, methodIdx) => (
                <div key={method.id}>
                  <div
                    className={`flex flex-col bg-surface-secondary rounded border overflow-hidden transition-colors ${
                      methodErrors.has(methodIdx)
                        ? "border-red-500"
                        : method.isConstructor
                          ? "border-purple-500/30"
                          : "border-surface-border"
                    }`}
                  >
                    <div
                      className={`flex items-center gap-3 p-2 border-b border-surface-border/50 ${method.isConstructor ? "bg-purple-900/10" : "bg-surface-secondary"}`}
                    >
                      <select
                        className={`bg-transparent font-mono outline-none cursor-pointer ${method.isConstructor ? "text-purple-400" : "text-uml-abstract-border"}`}
                        value={method.visibility}
                        onChange={(e) =>
                          updateMethod(methodIdx, "visibility", e.target.value)
                        }
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
                            ? "opacity-60 cursor-not-allowed border-transparent"
                            : methodErrors.has(methodIdx)
                              ? "border-red-500 text-red-500"
                              : "border-transparent focus:border-uml-class-border"
                        }`}
                        placeholder={t(
                          "modals.classEditor.placeholders.methodName",
                        )}
                        value={method.isConstructor ? draft.label : method.name}
                        disabled={method.isConstructor}
                        onChange={(e) =>
                          updateMethod(methodIdx, "name", e.target.value)
                        }
                      />

                      <span className="text-text-muted font-mono">():</span>

                      {method.isConstructor ? (
                        <span className="bg-purple-500/20 text-purple-300 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-purple-500/30 w-32 text-center">
                          &lt;&lt;create&gt;&gt;
                        </span>
                      ) : (
                        <>
                          <select
                            className="bg-surface-primary border border-surface-border rounded px-2 py-1 text-xs text-uml-interface-border outline-none w-32"
                            value={method.returnType}
                            onChange={(e) =>
                              updateMethod(
                                methodIdx,
                                "returnType",
                                e.target.value,
                              )
                            }
                          >
                            {availableTypes.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                          <label
                            className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-colors ${method.returnType === "void" ? "opacity-40 cursor-not-allowed bg-surface-primary/50 border-surface-border/50" : "cursor-pointer bg-surface-primary border-surface-border hover:border-uml-class-border"}`}
                          >
                            <input
                              type="checkbox"
                              disabled={method.returnType === "void"}
                              checked={!!method.isReturnArray}
                              onChange={(e) =>
                                updateMethod(
                                  methodIdx,
                                  "isReturnArray",
                                  e.target.checked,
                                )
                              }
                              className="accent-uml-class-border w-3 h-3 disabled:grayscale"
                            />
                            <span className="text-xs font-mono text-text-muted">
                              []
                            </span>
                          </label>
                        </>
                      )}

                      <div className="flex items-center gap-1 border-l border-surface-border pl-3 ml-1">
                        <button
                          onClick={() => moveMethod(methodIdx, "up")}
                          disabled={methodIdx === 0}
                          className="text-text-muted hover:text-white disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveMethod(methodIdx, "down")}
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
                          {t("modals.classEditor.parameters")}{" "}
                          {method.isConstructor &&
                            `(${t("modals.classEditor.constructor")})`}
                        </span>
                        <button
                          onClick={() => addParameter(methodIdx)}
                          className="text-[10px] flex items-center gap-1 text-blue-400/80 hover:text-blue-300"
                        >
                          <Plus className="w-3 h-3" />{" "}
                          {t("modals.classEditor.addParameter")}
                        </button>
                      </div>

                      {method.parameters?.length === 0 ? (
                        <span className="text-[10px] text-text-muted italic">
                          {t("modals.classEditor.noParameters")}
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
                                placeholder={t(
                                  "modals.classEditor.parameterNamePlaceholder",
                                )}
                                value={param.name}
                                onChange={(e) =>
                                  updateParameter(
                                    methodIdx,
                                    paramIdx,
                                    "name",
                                    e.target.value,
                                  )
                                }
                              />
                              <span className="text-text-muted text-xs font-mono">
                                :
                              </span>
                              <select
                                className="bg-surface-primary border border-surface-border rounded px-1.5 py-0.5 text-[11px] text-uml-interface-border outline-none w-28"
                                value={param.type}
                                onChange={(e) =>
                                  updateParameter(
                                    methodIdx,
                                    paramIdx,
                                    "type",
                                    e.target.value,
                                  )
                                }
                              >
                                {availableTypes.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <label className="flex items-center gap-1 cursor-pointer bg-surface-primary px-1.5 py-0.5 rounded border border-surface-border hover:border-uml-class-border transition-colors">
                                <input
                                  type="checkbox"
                                  checked={!!param.isArray}
                                  onChange={(e) =>
                                    updateParameter(
                                      methodIdx,
                                      paramIdx,
                                      "isArray",
                                      e.target.checked,
                                    )
                                  }
                                  className="accent-uml-class-border w-2.5 h-2.5"
                                />
                                <span className="text-[10px] font-mono text-text-muted">
                                  []
                                </span>
                              </label>
                              <button
                                onClick={() =>
                                  removeParameter(methodIdx, paramIdx)
                                }
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
                  {methodErrors.has(methodIdx) && (
                    <p className="text-xs text-red-500 mt-1 ml-2">
                      Method signature already exists in this class
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex justify-end gap-3 pt-4 mt-4 border-t border-surface-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            {t("modals.classEditor.cancel")}
          </button>
          <button
            onClick={() => onSave(draft)}
            className="px-6 py-2 text-sm bg-uml-class-border text-white rounded font-medium hover:brightness-110 shadow-md transition-all active:scale-95"
          >
            {t("modals.classEditor.save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
