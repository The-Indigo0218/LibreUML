import { useState, useMemo } from "react";
import { X, Check, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDiagramStore } from "../../../../store/diagramStore";
import type { UmlClassNode, UmlMethod, UmlAttribute } from "../../types/diagram.types";

interface MethodGeneratorModalProps {
  isOpen: boolean;
  nodeId: string | null;
  onClose: () => void;
}

export default function MethodGeneratorModal({ isOpen, nodeId, onClose }: MethodGeneratorModalProps) {
  const { t } = useTranslation();
  const nodes = useDiagramStore((s) => s.nodes);
  const updateNodeData = useDiagramStore((s) => s.updateNodeData);

  const classNode = useMemo(() => {
    return nodes.find((n) => n.id === nodeId) as UmlClassNode | undefined;
  }, [nodes, nodeId]);

  const [selectedAttributes, setSelectedAttributes] = useState<Set<string>>(new Set());

  if (!isOpen || !classNode) return null;

  const attributes = classNode.data.attributes;
  const existingMethods = classNode.data.methods;

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

  const generateGetter = (attr: UmlAttribute): UmlMethod => {
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

  const generateSetter = (attr: UmlAttribute): UmlMethod => {
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

  const generateConstructor = (selectedAttrs: UmlAttribute[]): UmlMethod => {
    return {
      id: crypto.randomUUID(),
      name: classNode.data.label,
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
    const newMethods: UmlMethod[] = [];

    selectedAttrs.forEach((attr) => {
      newMethods.push(generateGetter(attr));
      newMethods.push(generateSetter(attr));
    });

    updateNodeData(classNode.id, {
      methods: [...existingMethods, ...newMethods],
    });

    setSelectedAttributes(new Set());
    onClose();
  };

  const handleGenerateConstructor = () => {
    const selectedAttrs = attributes.filter((a) => selectedAttributes.has(a.id));
    const constructor = generateConstructor(selectedAttrs);

    updateNodeData(classNode.id, {
      methods: [...existingMethods, constructor],
    });

    setSelectedAttributes(new Set());
    onClose();
  };

  const handleGenerateAll = () => {
    const selectedAttrs = attributes.filter((a) => selectedAttributes.has(a.id));
    const newMethods: UmlMethod[] = [];

    const constructor = generateConstructor(selectedAttrs);
    newMethods.push(constructor);

    selectedAttrs.forEach((attr) => {
      newMethods.push(generateGetter(attr));
      newMethods.push(generateSetter(attr));
    });

    updateNodeData(classNode.id, {
      methods: [...existingMethods, ...newMethods],
    });

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
                {classNode.data.label}
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
