import { useMemo } from "react";
import { useUiStore } from "../../../../store/uiStore";
import { useModelStore } from "../../../../store/model.store";
import { useToastStore } from "../../../../store/toast.store";
import ClassEditorModal from "./ClassEditorModal";
import type {
  UmlClassData,
  UmlAttribute,
  UmlMethod,
  visibility as UmlVisibility,
} from "../../types/diagram.types";
import type {
  Visibility,
  IRAttribute,
  IROperation,
  SemanticModel,
  IRClass,
  IRInterface,
  IREnum,
} from "../../../../core/domain/vfs/vfs.types";
import { autoConnectByAttributeType } from "../../utils/autoConnect";

type ResolvedElement =
  | { kind: "CLASS"; data: IRClass }
  | { kind: "INTERFACE"; data: IRInterface }
  | { kind: "ENUM"; data: IREnum };

function resolveElement(
  model: SemanticModel,
  id: string,
): ResolvedElement | null {
  if (model.classes[id]) return { kind: "CLASS", data: model.classes[id] };
  if (model.interfaces[id])
    return { kind: "INTERFACE", data: model.interfaces[id] };
  if (model.enums[id]) return { kind: "ENUM", data: model.enums[id] };
  return null;
}

function irVisToUml(v: Visibility | undefined): UmlVisibility {
  if (v === "private") return "-";
  if (v === "protected") return "#";
  if (v === "package") return "~";
  return "+";
}

function umlVisToIr(v: UmlVisibility): Visibility {
  if (v === "-") return "private";
  if (v === "#") return "protected";
  if (v === "~") return "package";
  return "public";
}

function toUmlData(model: SemanticModel, element: ResolvedElement): UmlClassData {
  if (element.kind === "CLASS") {
    const attributes: UmlAttribute[] = element.data.attributeIds.flatMap((id) => {
      const a = model.attributes[id];
      if (!a) return [];
      return [{ id: a.id, name: a.name, type: a.type, visibility: irVisToUml(a.visibility), isArray: a.multiplicity === "*" || a.multiplicity === "0..*" }];
    });

    const methods: UmlMethod[] = element.data.operationIds.flatMap((id) => {
      const o = model.operations[id];
      if (!o) return [];
      return [{ id: o.id, name: o.name, returnType: o.returnType ?? "void", visibility: irVisToUml(o.visibility), parameters: o.parameters.map((p) => ({ name: p.name, type: p.type })) }];
    });

    return {
      label: element.data.name,
      package: element.data.packageName ?? "",
      attributes,
      methods,
      stereotype: element.data.isAbstract ? "abstract" : "class",
    };
  }

  if (element.kind === "INTERFACE") {
    const methods: UmlMethod[] = element.data.operationIds.flatMap((id) => {
      const o = model.operations[id];
      if (!o) return [];
      return [{ id: o.id, name: o.name, returnType: o.returnType ?? "void", visibility: irVisToUml(o.visibility), parameters: o.parameters.map((p) => ({ name: p.name, type: p.type })) }];
    });

    return {
      label: element.data.name,
      package: element.data.packageName ?? "",
      attributes: [],
      methods,
      stereotype: "interface",
    };
  }

  return {
    label: element.data.name,
    package: element.data.packageName ?? "",
    attributes: [],
    methods: [],
    stereotype: "enum",
  };
}

function toIrMembers(newData: UmlClassData): {
  attributes: IRAttribute[];
  operations: IROperation[];
} {
  const attributes: IRAttribute[] = newData.attributes.map((a) => ({
    id: a.id,
    kind: "ATTRIBUTE" as const,
    name: a.name,
    type: a.type,
    visibility: umlVisToIr(a.visibility),
    ...(a.isArray ? { multiplicity: "*" } : {}),
  }));

  const operations: IROperation[] = newData.methods.map((m) => ({
    id: m.id,
    kind: "OPERATION" as const,
    name: m.name,
    returnType: m.returnType,
    visibility: umlVisToIr(m.visibility),
    parameters: m.parameters.map((p) => ({ name: p.name, type: p.type })),
  }));

  return { attributes, operations };
}

export default function SSoTClassEditorModal() {
  const { activeModal, editingId, closeModals } = useUiStore();
  const model = useModelStore((s) => s.model);
  const updateClass = useModelStore((s) => s.updateClass);
  const updateInterface = useModelStore((s) => s.updateInterface);
  const updateEnum = useModelStore((s) => s.updateEnum);
  const setElementMembers = useModelStore((s) => s.setElementMembers);
  const setElementPackage = useModelStore((s) => s.setElementPackage);
  const showToast = useToastStore((s) => s.show);

  const isOpen = activeModal === "ssot-class-editor" && !!editingId;

  const element = useMemo(() => {
    if (!isOpen || !editingId || !model) return null;
    return resolveElement(model, editingId);
  }, [isOpen, editingId, model]);

  const umlData = useMemo(() => {
    if (!element || !model) return null;
    return toUmlData(model, element);
  }, [element, model]);

  const ssotContext = useMemo(() => {
    if (!model) return { elementNames: [], availableTypeNames: [] };
    const names = [
      ...Object.values(model.classes).map((c) => c.name),
      ...Object.values(model.interfaces).map((i) => i.name),
      ...Object.values(model.enums).map((e) => e.name),
    ];
    return { elementNames: names, availableTypeNames: names, packageNames: model.packageNames ?? [] };
  }, [model]);

  if (!isOpen || !umlData || !editingId || !element) return null;

  const handleSave = (newData: UmlClassData) => {
    if (!model) return;

    if (element.kind === "CLASS") {
      updateClass(editingId, { name: newData.label });
      const { attributes, operations } = toIrMembers(newData);
      setElementMembers(editingId, attributes, operations);
      autoConnectByAttributeType(editingId, attributes);
    } else if (element.kind === "INTERFACE") {
      updateInterface(editingId, { name: newData.label });
      const { operations } = toIrMembers(newData);
      setElementMembers(editingId, [], operations);
    } else {
      updateEnum(editingId, { name: newData.label });
    }

    setElementPackage(editingId, newData.package || undefined);
    showToast(`"${newData.label}" saved.`);
    closeModals();
  };

  return (
    <ClassEditorModal
      key={editingId}
      isOpen={true}
      umlData={umlData}
      onSave={handleSave}
      onClose={closeModals}
      ssotContext={ssotContext}
    />
  );
}
