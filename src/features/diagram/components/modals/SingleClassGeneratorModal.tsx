import { useState, useEffect, useMemo } from "react";
import { X, Code2, ChevronDown, FileCode } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../../../store/project.store";
import { useModelStore } from "../../../../store/model.store";
import { useUiStore } from "../../../../store/uiStore";
import { useCodeGenerationStore, LANGUAGE_OPTIONS, type TargetLanguage } from "../../../../store/codeGeneration.store";
import { JavaGeneratorService } from "../../../../services/javaGenerator.service";
import type { DomainNode } from "../../../../core/domain/models";
import type { DomainEdge } from "../../../../core/domain/models/edges";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Toggle Option Component ──────────────────────────────────────────────────

interface ToggleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleOption({ label, description, checked, onChange }: ToggleOptionProps) {
  return (
    <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors group">
      <div className="shrink-0 pt-0.5">
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`w-11 h-6 rounded-full transition-colors relative ${
            checked ? 'bg-blue-600' : 'bg-surface-border'
          }`}
        >
          <div
            className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium text-text-primary mb-0.5">{label}</div>
        <div className="text-xs text-text-muted leading-relaxed">{description}</div>
      </div>
    </label>
  );
}

// ─── IR → DomainNode adapter ─────────────────────────────────────────────────

function irVisToSymbol(vis?: string): '+' | '-' | '#' | '~' {
  if (vis === 'private') return '-';
  if (vis === 'protected') return '#';
  if (vis === 'package') return '~';
  return '+';
}

type SemanticModel = NonNullable<ReturnType<typeof useModelStore.getState>['model']>;

function irToDomainNode(elementId: string, model: SemanticModel): DomainNode | null {
  const cls = model.classes[elementId];
  if (cls) {
    const attributes = cls.attributeIds
      .map((id) => {
        const attr = model.attributes[id];
        if (!attr) return null;
        return { id: attr.id, name: attr.name, type: attr.type || 'String', visibility: irVisToSymbol(attr.visibility), isArray: false, isStatic: attr.isStatic ?? false };
      })
      .filter(Boolean);
    const methods = cls.operationIds
      .map((id) => {
        const op = model.operations[id];
        if (!op) return null;
        return { id: op.id, name: op.name, returnType: op.returnType || 'void', visibility: irVisToSymbol(op.visibility), isStatic: op.isStatic ?? false, parameters: op.parameters.map((p) => ({ name: p.name, type: p.type })) };
      })
      .filter(Boolean);
    return { id: elementId, type: cls.isAbstract ? 'ABSTRACT_CLASS' : 'CLASS', name: cls.name, attributes, methods } as unknown as DomainNode;
  }

  const iface = model.interfaces[elementId];
  if (iface) {
    const methods = iface.operationIds
      .map((id) => {
        const op = model.operations[id];
        if (!op) return null;
        return { id: op.id, name: op.name, returnType: op.returnType || 'void', visibility: irVisToSymbol(op.visibility), isStatic: op.isStatic ?? false, parameters: op.parameters.map((p) => ({ name: p.name, type: p.type })) };
      })
      .filter(Boolean);
    return { id: elementId, type: 'INTERFACE', name: iface.name, attributes: [], methods } as unknown as DomainNode;
  }

  const enm = model.enums[elementId];
  if (enm) {
    return { id: elementId, type: 'ENUM', name: enm.name, attributes: [], methods: [] } as unknown as DomainNode;
  }

  return null;
}

function buildAllIRNodes(model: SemanticModel): DomainNode[] {
  const nodes: DomainNode[] = [];
  for (const id of Object.keys(model.classes)) {
    const n = irToDomainNode(id, model);
    if (n) nodes.push(n);
  }
  for (const id of Object.keys(model.interfaces)) {
    const n = irToDomainNode(id, model);
    if (n) nodes.push(n);
  }
  return nodes;
}

function buildIREdges(model: SemanticModel): DomainEdge[] {
  const kindMap: Record<string, string> = {
    GENERALIZATION: 'INHERITANCE',
    REALIZATION: 'IMPLEMENTATION',
  };
  return Object.values(model.relations).map((rel) => ({
    id: rel.id,
    type: kindMap[rel.kind] ?? rel.kind,
    sourceNodeId: rel.sourceId,
    targetNodeId: rel.targetId,
  })) as unknown as DomainEdge[];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SingleClassGeneratorModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const projectNodes = useProjectStore((s) => s.nodes);
  const nodes = useMemo(() => Object.values(projectNodes), [projectNodes]);
  const projectEdges = useProjectStore((s) => s.edges);
  const edges = useMemo(() => Object.values(projectEdges), [projectEdges]);

  const model = useModelStore((s) => s.model);
  const editingId = useUiStore((s) => s.editingId);

  const {
    config,
    setTargetLanguage,
    setGenerateGettersSetters,
    setGenerateEmptyConstructors,
    setIncludePackageDeclaration,
    setGenerateDocStubs,
  } = useCodeGenerationStore();

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [generatedCode, setGeneratedCode] = useState("");

  // ── Combined class list (ProjectStore + ModelStore, deduplicated) ─────────

  const allClasses = useMemo(() => {
    const entries: Array<{ id: string; name: string; type: string }> = [];
    const seen = new Set<string>();

    nodes.forEach((node) => {
      if (node.type === 'CLASS' || node.type === 'INTERFACE' || node.type === 'ABSTRACT_CLASS' || node.type === 'ENUM') {
        entries.push({ id: node.id, name: 'name' in node ? (node as { name: string }).name : 'Unknown', type: node.type });
        seen.add(node.id);
      }
    });

    if (model) {
      Object.values(model.classes).forEach((cls) => {
        if (!seen.has(cls.id)) {
          entries.push({ id: cls.id, name: cls.name, type: cls.isAbstract ? 'ABSTRACT_CLASS' : 'CLASS' });
          seen.add(cls.id);
        }
      });
      Object.values(model.interfaces).forEach((iface) => {
        if (!seen.has(iface.id)) {
          entries.push({ id: iface.id, name: iface.name, type: 'INTERFACE' });
          seen.add(iface.id);
        }
      });
      Object.values(model.enums).forEach((enm) => {
        if (!seen.has(enm.id)) {
          entries.push({ id: enm.id, name: enm.name, type: 'ENUM' });
          seen.add(enm.id);
        }
      });
    }

    return entries;
  }, [nodes, model]);

  // ── Auto-select class when modal opens ───────────────────────────────────

  useEffect(() => {
    if (!isOpen) {
      setGeneratedCode("");
      setSelectedClassId("");
      return;
    }

    if (editingId) {
      setSelectedClassId(editingId);
      return;
    }

    const firstFromProject = nodes.find(
      (n) => n.type === 'CLASS' || n.type === 'ABSTRACT_CLASS' || n.type === 'INTERFACE',
    );
    if (firstFromProject) {
      setSelectedClassId(firstFromProject.id);
      return;
    }

    const snap = useModelStore.getState().model;
    if (snap) {
      const firstClass = Object.values(snap.classes)[0];
      if (firstClass) { setSelectedClassId(firstClass.id); return; }
      const firstIface = Object.values(snap.interfaces)[0];
      if (firstIface) { setSelectedClassId(firstIface.id); return; }
    }

    setSelectedClassId("");
  }, [isOpen, editingId, nodes]);

  // ── Generate code when class or config changes ───────────────────────────

  useEffect(() => {
    if (!selectedClassId) {
      setGeneratedCode("// " + t('modals.codePreview.noClassSelected', "No class selected"));
      return;
    }

    // Try ProjectStore first
    const projNode = nodes.find((n) => n.id === selectedClassId);
    if (projNode && (projNode.type === 'CLASS' || projNode.type === 'INTERFACE' || projNode.type === 'ABSTRACT_CLASS' || projNode.type === 'ENUM')) {
      if (config.targetLanguage === 'java') {
        setGeneratedCode(JavaGeneratorService.generate(projNode, nodes, edges));
      } else {
        setGeneratedCode("// Coming soon...");
      }
      return;
    }

    // Try ModelStore
    if (model) {
      const fakeNode = irToDomainNode(selectedClassId, model);
      if (fakeNode) {
        if (config.targetLanguage === 'java') {
          const allIRNodes = buildAllIRNodes(model);
          const irEdges = buildIREdges(model);
          setGeneratedCode(JavaGeneratorService.generate(fakeNode, allIRNodes, irEdges));
        } else {
          setGeneratedCode("// Coming soon...");
        }
        return;
      }
    }

    setGeneratedCode("// " + t('modals.codePreview.invalidNode', "Selected node is not a valid Class/Interface"));
  }, [selectedClassId, nodes, edges, config, model, t]);

  // ── Close dropdown when clicking outside ─────────────────────────────────

  useEffect(() => {
    const handleClickOutside = () => setShowLanguageDropdown(false);
    if (showLanguageDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showLanguageDropdown]);

  const selectedEntry = allClasses.find((e) => e.id === selectedClassId);
  const selectedClassName = selectedEntry?.name ?? 'Unknown';

  const selectedLanguage = LANGUAGE_OPTIONS.find((opt) => opt.value === config.targetLanguage);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Code2 className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                {t('singleClassGenerator.title')}
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                {selectedClassName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-text-muted hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex">

          {/* Left Panel: Configuration */}
          <div className="w-80 border-r border-surface-border overflow-y-auto p-6 space-y-6 custom-scrollbar">

            {/* Language Selector */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                {t('codeExportModal.targetLanguage')}
              </label>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLanguageDropdown(!showLanguageDropdown);
                  }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-surface-secondary border border-surface-border rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <span className="text-sm font-medium text-text-primary">
                    {selectedLanguage?.label}
                  </span>
                  <ChevronDown className="w-4 h-4 text-text-muted" />
                </button>

                {showLanguageDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-surface-secondary border border-surface-border rounded-lg shadow-xl py-1 z-50">
                    {LANGUAGE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          if (option.enabled) {
                            setTargetLanguage(option.value as TargetLanguage);
                            setShowLanguageDropdown(false);
                          }
                        }}
                        disabled={!option.enabled}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                          option.enabled
                            ? 'hover:bg-surface-hover text-text-primary'
                            : 'text-text-muted cursor-not-allowed'
                        } ${config.targetLanguage === option.value ? 'bg-surface-hover' : ''}`}
                      >
                        <span>{option.label}</span>
                        {option.comingSoon && (
                          <span className="text-xs text-text-muted bg-surface-primary px-2 py-0.5 rounded">
                            {t('codeExportModal.comingSoon')}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Class Selector */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2">
                {t('singleClassGenerator.selectClass')}
              </label>
              <select
                className="w-full bg-surface-secondary border border-surface-border rounded-lg px-4 py-3 text-sm text-text-primary outline-none focus:border-blue-500 transition-colors"
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
              >
                {allClasses.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} {entry.type !== 'CLASS' ? `(${entry.type.toLowerCase()})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Generation Options */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
                {t('codeExportModal.options.title')}
              </label>
              <div className="space-y-3">

                <ToggleOption
                  label={t('codeExportModal.options.generateGettersSetters')}
                  description={t('codeExportModal.options.generateGettersSettersDesc')}
                  checked={config.generateGettersSetters}
                  onChange={setGenerateGettersSetters}
                />

                <ToggleOption
                  label={t('codeExportModal.options.generateEmptyConstructors')}
                  description={t('codeExportModal.options.generateEmptyConstructorsDesc')}
                  checked={config.generateEmptyConstructors}
                  onChange={setGenerateEmptyConstructors}
                />

                <ToggleOption
                  label={t('codeExportModal.options.includePackageDeclaration')}
                  description={t('codeExportModal.options.includePackageDeclarationDesc')}
                  checked={config.includePackageDeclaration}
                  onChange={setIncludePackageDeclaration}
                />

                <ToggleOption
                  label={t('codeExportModal.options.generateDocStubs')}
                  description={t('codeExportModal.options.generateDocStubsDesc')}
                  checked={config.generateDocStubs}
                  onChange={setGenerateDocStubs}
                />

              </div>
            </div>
          </div>

          {/* Right Panel: Code Preview */}
          <div className="flex-1 flex flex-col bg-[#1e1e1e]">
            <div className="px-4 py-2 border-b border-surface-border bg-[#252526] flex items-center gap-2">
              <FileCode className="w-4 h-4 text-text-muted" />
              <span className="text-xs text-text-muted font-mono">
                {selectedClassName}.java
              </span>
            </div>
            <div className="flex-1 overflow-auto custom-scrollbar">
              <pre className="p-6 text-sm font-mono text-gray-300 leading-relaxed">
                {generatedCode}
              </pre>
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-surface-border flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
          >
            {t('codeExportModal.actions.cancel')}
          </button>
          <button
            onClick={async () => {
              await navigator.clipboard.writeText(generatedCode);
            }}
            className="px-6 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Code2 className="w-4 h-4" />
            {t('singleClassGenerator.copyCode')}
          </button>
        </div>
      </div>
    </div>
  );
}
