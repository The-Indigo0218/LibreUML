import { useMemo } from "react";
import { useUiStore } from "../../../../store/uiStore";
import { useModelStore } from "../../../../store/model.store";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useToastStore } from "../../../../store/toast.store";
import { standaloneModelOps } from "../../../../store/standaloneModelOps";
import { undoTransaction } from "../../../../core/undo/undoBridge";
import { computeNewRelations } from "../../utils/autoConnect";
import { isDiagramView } from "../../hooks/useVFSCanvasController";
import ClassEditorModal from "./ClassEditorModal";
import type {
  UmlClassData,
  UmlAttribute,
  UmlMethod,
  UmlEnumLiteral,
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
  VFSFile,
} from "../../../../core/domain/vfs/vfs.types";

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

  // Map IREnumLiterals → UmlEnumLiterals so the EnumLiteralsEditor
  // in ClassEditorModal can display and edit them.
  const literals: UmlEnumLiteral[] = element.data.literals.map((l, i) => ({
    id: `lit-${i}-${l.name}`,
    name: l.name,
    value: l.value,
  }));

  return {
    label: element.data.name,
    package: element.data.packageName ?? "",
    attributes: [],
    methods: [],
    stereotype: "enum",
    literals,
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
  const showToast = useToastStore((s) => s.show);

  // Standalone context: resolve active file's isolation status and localModel.
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const isStandalone = useVFSStore((s): boolean => {
    if (!activeTabId || !s.project) return false;
    const node = s.project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return false;
    return (node as VFSFile).standalone === true;
  });
  const localModel = useVFSStore((s): SemanticModel | null => {
    if (!activeTabId || !s.project) return null;
    const node = s.project.nodes[activeTabId];
    if (!node || node.type !== 'FILE') return null;
    return (node as VFSFile).localModel ?? null;
  });

  // Use localModel when active file is standalone; global model otherwise.
  const activeModel = isStandalone ? localModel : model;

  const isOpen = activeModal === "ssot-class-editor" && !!editingId;

  const element = useMemo(() => {
    if (!isOpen || !editingId || !activeModel) return null;
    return resolveElement(activeModel, editingId);
  }, [isOpen, editingId, activeModel]);

  const umlData = useMemo(() => {
    if (!element || !activeModel) return null;
    return toUmlData(activeModel, element);
  }, [element, activeModel]);

  const ssotContext = useMemo(() => {
    if (!activeModel) return { elementNames: [], availableTypeNames: [] };
    const names = [
      ...Object.values(activeModel.classes).map((c) => c.name),
      ...Object.values(activeModel.interfaces).map((i) => i.name),
      ...Object.values(activeModel.enums).map((e) => e.name),
    ];
    return { elementNames: names, availableTypeNames: names, packageNames: activeModel.packageNames ?? [] };
  }, [activeModel]);

  if (!isOpen || !umlData || !editingId || !element) return null;

  const handleSave = (newData: UmlClassData) => {
    if (!activeModel) return;

    if (isStandalone && activeTabId) {
      // Standalone path: all mutations route through standaloneModelOps.
      // autoConnectByAttributeType is skipped — it reads/writes global ModelStore.
      const ops = standaloneModelOps(activeTabId);
      if (element.kind === "CLASS") {
        ops.updateClass(editingId, { name: newData.label });
        const { attributes, operations } = toIrMembers(newData);
        ops.setElementMembers(editingId, attributes, operations);
      } else if (element.kind === "INTERFACE") {
        ops.updateInterface(editingId, { name: newData.label });
        const { operations } = toIrMembers(newData);
        ops.setElementMembers(editingId, [], operations);
      } else {
        ops.updateEnum(editingId, {
          name: newData.label,
          literals: (newData.literals ?? []).map((l) => ({
            name: l.name,
            ...(l.value !== undefined && l.value !== '' ? { value: l.value } : {}),
          })),
        });
      }
      ops.setElementPackage(editingId, newData.package || undefined);
    } else {
      // Global model path: single undoTransaction so one Ctrl+Z undoes the full edit.
      if (!model) return;
      const pkg = newData.package || undefined;

      if (element.kind === "CLASS") {
        const { attributes, operations } = toIrMembers(newData);
        // Pre-compute auto-connect data from current state before any mutation.
        const newRelations = computeNewRelations(editingId, attributes);

        undoTransaction({
          label: `Edit Class: ${element.data.name}`,
          scope: 'global',
          mutations: [
            {
              store: 'model',
              mutate: (draft: any) => {
                if (!draft.model) return;
                const cls = draft.model.classes[editingId];
                if (!cls) return;
                cls.name = newData.label;
                if (pkg !== undefined) cls.packageName = pkg;
                cls.attributeIds.forEach((id: string) => { delete draft.model.attributes[id]; });
                cls.operationIds.forEach((id: string) => { delete draft.model.operations[id]; });
                attributes.forEach((a: IRAttribute) => { draft.model.attributes[a.id] = a; });
                operations.forEach((o: IROperation) => { draft.model.operations[o.id] = o; });
                cls.attributeIds = attributes.map((a: IRAttribute) => a.id);
                cls.operationIds = operations.map((o: IROperation) => o.id);
                for (const { relationId, kind, targetElementId } of newRelations) {
                  draft.model.relations[relationId] = {
                    id: relationId, kind, sourceId: editingId, targetId: targetElementId,
                  };
                }
                draft.model.updatedAt = Date.now();
              },
            },
            {
              store: 'vfs',
              mutate: (draft: any) => {
                if (!activeTabId || newRelations.length === 0) return;
                const node = draft.project?.nodes[activeTabId];
                if (!node || node.type !== 'FILE' || !isDiagramView(node.content)) return;
                for (const { viewEdge } of newRelations) {
                  node.content.edges.push(viewEdge);
                }
              },
            },
          ],
        });
      } else if (element.kind === "INTERFACE") {
        const { operations } = toIrMembers(newData);
        undoTransaction({
          label: `Edit Interface: ${element.data.name}`,
          scope: 'global',
          mutations: [{
            store: 'model',
            mutate: (draft: any) => {
              if (!draft.model) return;
              const iface = draft.model.interfaces[editingId];
              if (!iface) return;
              iface.name = newData.label;
              if (pkg !== undefined) iface.packageName = pkg;
              iface.operationIds.forEach((id: string) => { delete draft.model.operations[id]; });
              operations.forEach((o: IROperation) => { draft.model.operations[o.id] = o; });
              iface.operationIds = operations.map((o: IROperation) => o.id);
              draft.model.updatedAt = Date.now();
            },
          }],
        });
      } else {
        const literals = (newData.literals ?? []).map((l) => ({
          name: l.name,
          ...(l.value !== undefined && l.value !== '' ? { value: l.value } : {}),
        }));
        undoTransaction({
          label: `Edit Enum: ${element.data.name}`,
          scope: 'global',
          mutations: [{
            store: 'model',
            mutate: (draft: any) => {
              if (!draft.model) return;
              const enm = draft.model.enums[editingId];
              if (!enm) return;
              enm.name = newData.label;
              if (pkg !== undefined) enm.packageName = pkg;
              enm.literals = literals;
              draft.model.updatedAt = Date.now();
            },
          }],
        });
      }
    }

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
