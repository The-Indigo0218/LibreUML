import { useState, useMemo } from "react";
import { X, Check, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../../../store/project.store";
import type { DomainNode } from "../../../../core/domain/models/nodes";

interface MethodGeneratorModalProps {
  isOpen: boolean;
  nodeId: string | null;
  onClose: () => void;
}

// Helper types matching the domain model attribute/method shapes
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

export default function MethodGeneratorModal({ isOpen, nodeId, onClose }: MethodGeneratorModalProps) {
  const { t } = useTranslation();
  const getNode = useProjectStore((s) => s.getNode);
  const updateNode = useProjectStore((s) => s.updateNode);

  const classNode = useMemo(() => {
    if (!nodeId) return undefined;
    return getNode(nodeId);
  }, [nodeId, getNode]);

  const [selectedAttributes, setSelectedAttributes] = useState<Set<string>>(new Set());

  if (!isOpen || !classNode) return null;
  if (classNode.type !== 'CLASS' && classNode.type !== 'ABSTRACT_CLASS') return null;

  // Access domain model properties
  const typedNode = classNode as DomainNode & { attributes: DomainAttribute[]; methods: DomainMethod[] };
  const attributes = typedNode.attributes || [];
  const existingMethods = typedNode.methods || [];
  const className = classNode.name;

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

  const capitalizeFirst = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const generateGetter = (attr: DomainAttribute): DomainMethod => {
    return {
      id: crypto.randomUUID(),
      name: `get${capitalizeFirst(attr.name)}`,
      returnType: attr.type,
      isReturnArray: attr.isArray,
      visibility: "+",
      isStatic: false,
      parameters: [],
    };
  };

  const generateSetter = (attr: DomainAttribute): DomainMethod => {
    return {
      id: crypto.randomUUID(),
      name: `set${capitalizeFirst(attr.name)}`,
      returnType: "void",
      isReturnArray: false,
      visibility: "+",
      isStatic: false,
      parameters: [
        {
          name: attr.name,
          type: attr.type,
          isArray: attr.isArray,
        },
      ],
    };
  };

  const generateConstructor = (selectedAttrs: DomainAttribute[]): DomainMethod => {
    return {
      id: crypto.randomUUID(),
      name: className,
      returnType: "",
      isReturnArray: false,
      visibility: "+",
      isStatic: false,
      isConstructor: true,
      parameters: selectedAttrs.map((attr) => ({
        name: attr.name,
        type: attr.type,
        isArray: attr.isArray,
      })),
    };
  };

  const handleGenerateGettersSetters = () => {
    const selectedAttrs = attributes.filter((a) => selectedAttributes.has(a.id));
    const newMethods: DomainMethod[] = [];

    selectedAttrs.forEach((attr) => {
      newMethods.push(generateGetter(attr));
      newMethods.push(generateSetter(attr));
    });

    updateNode(classNode.id, {
      methods: [...existingMethods, ...newMethods],
    } as any);

    setSelectedAttributes(new Set());
    onClose();
  };

  const handleGenerateConstructor = () => {
    const selectedAttrs = attributes.filter((a) => selectedAttributes.has(a.id));
    const constructor = generateConstructor(selectedAttrs);

    updateNode(classNode.id, {
      methods: [...existingMethods, constructor],
    } as any);

    setSelectedAttributes(new Set());
    onClose();
  };

  const handleGenerateAll = () => {
    const selectedAttrs = attributes.filter((a) => selectedAttributes.has(a.id));
    const newMethods: DomainMethod[] = [];

    const constructor = generateConstructor(selectedAttrs);
    newMethods.push(constructor);

    selectedAttrs.forEach((attr) => {
      newMethods.push(generateGetter(attr));
      newMethods.push(generateSetter(attr));
    });

    updateNode(classNode.id, {
      methods: [...existingMethods, ...newMethods],
    } as any);

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
