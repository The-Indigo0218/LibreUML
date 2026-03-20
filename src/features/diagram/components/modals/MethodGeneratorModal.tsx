import { useState, useMemo } from "react";
import { X, Check, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../../../store/project.store";
import { useModelStore } from "../../../../store/model.store";
import type { DomainNode } from "../../../../core/domain/models/nodes";
import type { IROperation } from "../../../../core/domain/vfs/vfs.types";

interface MethodGeneratorModalProps {
  isOpen: boolean;
  nodeId: string | null;
  onClose: () => void;
}

interface DomainAttribute {
  id: string;
  name: string;
  type: string;
  visibility: string;
  isArray?: boolean;
  isStatic?: boolean;
}

interface DomainMethod {
  id: string;
  name: string;
  returnType: string;
  visibility: string;
  isReturnArray?: boolean;
  isStatic?: boolean;
  isConstructor?: boolean;
  parameters: { name: string; type: string; isArray?: boolean }[];
}

// ─── IR ↔ domain adapters ─────────────────────────────────────────────────────

function irVisToSymbol(vis?: string): string {
  if (vis === 'private') return '-';
  if (vis === 'protected') return '#';
  if (vis === 'package') return '~';
  return '+';
}

function domainMethodToIROperation(m: DomainMethod): IROperation {
  const visMap: Record<string, 'public' | 'private' | 'protected' | 'package'> = {
    '+': 'public', '-': 'private', '#': 'protected', '~': 'package',
  };
  return {
    id: m.id,
    name: m.name,
    kind: 'OPERATION',
    visibility: visMap[m.visibility] ?? 'public',
    returnType: m.returnType || 'void',
    isStatic: m.isStatic ?? false,
    isConstructor: m.isConstructor,
    parameters: (m.parameters ?? []).map((p) => ({ name: p.name, type: p.type })),
  } as IROperation;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MethodGeneratorModal({ isOpen, nodeId, onClose }: MethodGeneratorModalProps) {
  const { t } = useTranslation();
  const getNode = useProjectStore((s) => s.getNode);
  const updateNode = useProjectStore((s) => s.updateNode);
  const model = useModelStore((s) => s.model);

  // ── Resolve the class — ProjectStore first, then ModelStore ─────────────
  const projectClassNode = useMemo(() => {
    if (!nodeId) return undefined;
    return getNode(nodeId);
  }, [nodeId, getNode]);

  const irClass = useMemo(() => {
    if (!nodeId || !model || projectClassNode) return null;
    return model.classes[nodeId] ?? null;
  }, [nodeId, model, projectClassNode]);

  const attributes = useMemo((): DomainAttribute[] => {
    if (projectClassNode) {
      const typed = projectClassNode as DomainNode & { attributes: DomainAttribute[] };
      return typed.attributes || [];
    }
    if (irClass && model) {
      return irClass.attributeIds
        .map((id) => {
          const attr = model.attributes[id];
          if (!attr) return null;
          return {
            id: attr.id,
            name: attr.name,
            type: attr.type || 'String',
            visibility: irVisToSymbol(attr.visibility),
            isArray: false,
            isStatic: attr.isStatic ?? false,
          } as DomainAttribute;
        })
        .filter(Boolean) as DomainAttribute[];
    }
    return [];
  }, [projectClassNode, irClass, model]);

  const existingMethods = useMemo((): DomainMethod[] => {
    if (projectClassNode) {
      const typed = projectClassNode as DomainNode & { methods: DomainMethod[] };
      return typed.methods || [];
    }
    return [];
  }, [projectClassNode]);

  const className: string = (projectClassNode as any)?.name ?? irClass?.name ?? '';

  const [selectedAttributes, setSelectedAttributes] = useState<Set<string>>(new Set());

  if (!isOpen) return null;
  if (!projectClassNode && !irClass) return null;
  if (projectClassNode && projectClassNode.type !== 'CLASS' && projectClassNode.type !== 'ABSTRACT_CLASS') return null;

  const toggleAttribute = (attrId: string) => {
    setSelectedAttributes((prev) => {
      const next = new Set(prev);
      if (next.has(attrId)) {
        next.delete(attrId);
      } else {
        next.add(attrId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedAttributes.size === attributes.length) {
      setSelectedAttributes(new Set());
    } else {
      setSelectedAttributes(new Set(attributes.map((a) => a.id)));
    }
  };

  const capitalizeFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

  const generateGetter = (attr: DomainAttribute): DomainMethod => ({
    id: crypto.randomUUID(),
    name: `get${capitalizeFirst(attr.name)}`,
    returnType: attr.type,
    isReturnArray: attr.isArray,
    visibility: "+",
    isStatic: false,
    parameters: [],
  });

  const generateSetter = (attr: DomainAttribute): DomainMethod => ({
    id: crypto.randomUUID(),
    name: `set${capitalizeFirst(attr.name)}`,
    returnType: "void",
    isReturnArray: false,
    visibility: "+",
    isStatic: false,
    parameters: [{ name: attr.name, type: attr.type, isArray: attr.isArray }],
  });

  const generateConstructor = (selectedAttrs: DomainAttribute[]): DomainMethod => ({
    id: crypto.randomUUID(),
    name: className,
    returnType: "",
    isReturnArray: false,
    visibility: "+",
    isStatic: false,
    isConstructor: true,
    parameters: selectedAttrs.map((attr) => ({ name: attr.name, type: attr.type, isArray: attr.isArray })),
  });

  // Write-back: ProjectStore or ModelStore
  const commitMethods = (newMethods: DomainMethod[]) => {
    if (projectClassNode) {
      updateNode(projectClassNode.id, { methods: [...existingMethods, ...newMethods] } as any);
    } else if (irClass && nodeId && model) {
      const existingOps = irClass.operationIds
        .map((id) => model.operations[id])
        .filter(Boolean) as IROperation[];
      const newOps = newMethods.map(domainMethodToIROperation);
      const existingAttrs = irClass.attributeIds
        .map((id) => model.attributes[id])
        .filter(Boolean);
      useModelStore.getState().setElementMembers(nodeId, existingAttrs as any, [...existingOps, ...newOps]);
    }
  };

  const handleGenerateGettersSetters = () => {
    const selectedAttrs = attributes.filter((a) => selectedAttributes.has(a.id));
    const newMethods: DomainMethod[] = [];
    selectedAttrs.forEach((attr) => {
      newMethods.push(generateGetter(attr));
      newMethods.push(generateSetter(attr));
    });
    commitMethods(newMethods);
    setSelectedAttributes(new Set());
    onClose();
  };

  const handleGenerateConstructor = () => {
    const selectedAttrs = attributes.filter((a) => selectedAttributes.has(a.id));
    commitMethods([generateConstructor(selectedAttrs)]);
    setSelectedAttributes(new Set());
    onClose();
  };

  const handleGenerateAll = () => {
    const selectedAttrs = attributes.filter((a) => selectedAttributes.has(a.id));
    const newMethods: DomainMethod[] = [generateConstructor(selectedAttrs)];
    selectedAttrs.forEach((attr) => {
      newMethods.push(generateGetter(attr));
      newMethods.push(generateSetter(attr));
    });
    commitMethods(newMethods);
    setSelectedAttributes(new Set());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-primary border border-surface-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <Wand2 className="w-5 h-5 text-uml-class-border" />
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                {t("modals.methodGenerator.title")}
              </h2>
              <p className="text-sm text-text-muted">
                {className}
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {attributes.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <p>{t("modals.methodGenerator.noAttributes")}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text-primary">
                  {t("modals.methodGenerator.selectAttributes")}
                </h3>
                <button
                  onClick={toggleAll}
                  className="text-xs text-uml-class-border hover:text-uml-class-border/80 transition-colors"
                >
                  {selectedAttributes.size === attributes.length
                    ? t("modals.methodGenerator.deselectAll")
                    : t("modals.methodGenerator.selectAll")}
                </button>
              </div>

              <div className="space-y-2">
                {attributes.map((attr) => (
                  <label
                    key={attr.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover cursor-pointer transition-colors group"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAttributes.has(attr.id)}
                      onChange={() => toggleAttribute(attr.id)}
                      className="w-4 h-4 rounded border-surface-border bg-surface-secondary text-uml-class-border focus:ring-2 focus:ring-uml-class-border focus:ring-offset-0 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-text-primary">
                          {attr.visibility} {attr.name}
                        </span>
                        <span className="text-xs text-text-muted">:</span>
                        <span className="text-sm text-text-secondary">
                          {attr.type}
                          {attr.isArray && "[]"}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-surface-border bg-surface-secondary/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
          >
            {t("modals.methodGenerator.cancel")}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateGettersSetters}
              disabled={selectedAttributes.size === 0}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {t("modals.methodGenerator.generateGettersSetters")}
            </button>

            <button
              onClick={handleGenerateConstructor}
              disabled={selectedAttributes.size === 0}
              className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {t("modals.methodGenerator.generateConstructor")}
            </button>

            <button
              onClick={handleGenerateAll}
              disabled={selectedAttributes.size === 0}
              className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Wand2 className="w-4 h-4" />
              {t("modals.methodGenerator.generateAll")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
