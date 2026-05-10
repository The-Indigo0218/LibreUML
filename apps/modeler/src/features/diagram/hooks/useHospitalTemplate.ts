import { useCallback } from "react";
import { useWorkspaceStore } from "../../../store/workspace.store";
import { useVFSStore } from "../../../store/project-vfs.store";
import { useModelStore } from "../../../store/model.store";
import { standaloneModelOps, ensureLocalModel } from "../../../store/standaloneModelOps";
import { isDiagramView } from "./useVFSCanvasController";
import type { DiagramView, ViewNode, ViewEdge, VFSFile } from "../../../core/domain/vfs/vfs.types";

const POSITIONS = {
  patient:     { x: 80,  y: 160 },
  doctor:      { x: 520, y: 160 },
  appointment: { x: 300, y: 380 },
} as const;

/**
 * Returns a `loadTemplate()` callback that populates the active diagram with
 * a simple Hospital System (Patient, Doctor, Appointment + 2 associations).
 *
 * Works for both project-backed and standalone files.
 */
export function useHospitalTemplate() {
  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const updateFileContent = useVFSStore((s) => s.updateFileContent);

  const loadTemplate = useCallback(() => {
    if (!activeTabId) return;

    const project = useVFSStore.getState().project;
    if (!project) return;

    const fileNode = project.nodes[activeTabId];
    if (!fileNode || fileNode.type !== "FILE") return;

    const vfsFile = fileNode as VFSFile;
    const isStandaloneFile = vfsFile.standalone === true;

    const currentView: DiagramView = isDiagramView(vfsFile.content)
      ? (vfsFile.content as DiagramView)
      : { diagramId: activeTabId, nodes: [], edges: [] };

    let patientId: string;
    let doctorId: string;
    let appointmentId: string;
    let rel1Id: string;
    let rel2Id: string;

    if (isStandaloneFile) {
      ensureLocalModel(activeTabId);
      const ops = standaloneModelOps(activeTabId);

      patientId = ops.createClass({
        name: "Patient",
        attributeIds: [],
        operationIds: [],
        documentation: "Represents a hospital patient",
      });
      doctorId = ops.createClass({
        name: "Doctor",
        attributeIds: [],
        operationIds: [],
        documentation: "Represents a medical doctor",
      });
      appointmentId = ops.createClass({
        name: "Appointment",
        attributeIds: [],
        operationIds: [],
        documentation: "Scheduled medical appointment",
      });

      rel1Id = ops.createRelation({
        kind: "ASSOCIATION",
        sourceId: patientId,
        targetId: appointmentId,
        name: "schedules",
        sourceEnd: { elementId: patientId, multiplicity: "1" },
        targetEnd: { elementId: appointmentId, multiplicity: "*" },
      });
      rel2Id = ops.createRelation({
        kind: "ASSOCIATION",
        sourceId: doctorId,
        targetId: appointmentId,
        name: "attends",
        sourceEnd: { elementId: doctorId, multiplicity: "1" },
        targetEnd: { elementId: appointmentId, multiplicity: "*" },
      });
    } else {
      const store = useModelStore.getState();

      patientId = store.createClass({
        name: "Patient",
        attributeIds: [],
        operationIds: [],
        documentation: "Represents a hospital patient",
      });
      doctorId = store.createClass({
        name: "Doctor",
        attributeIds: [],
        operationIds: [],
        documentation: "Represents a medical doctor",
      });
      appointmentId = store.createClass({
        name: "Appointment",
        attributeIds: [],
        operationIds: [],
        documentation: "Scheduled medical appointment",
      });

      rel1Id = store.createRelation({
        kind: "ASSOCIATION",
        sourceId: patientId,
        targetId: appointmentId,
        name: "schedules",
        sourceEnd: { elementId: patientId, multiplicity: "1" },
        targetEnd: { elementId: appointmentId, multiplicity: "*" },
      });
      rel2Id = store.createRelation({
        kind: "ASSOCIATION",
        sourceId: doctorId,
        targetId: appointmentId,
        name: "attends",
        sourceEnd: { elementId: doctorId, multiplicity: "1" },
        targetEnd: { elementId: appointmentId, multiplicity: "*" },
      });
    }

    const newViewNodes: ViewNode[] = [
      { id: crypto.randomUUID(), elementId: patientId,     x: POSITIONS.patient.x,     y: POSITIONS.patient.y     },
      { id: crypto.randomUUID(), elementId: doctorId,      x: POSITIONS.doctor.x,      y: POSITIONS.doctor.y      },
      { id: crypto.randomUUID(), elementId: appointmentId, x: POSITIONS.appointment.x, y: POSITIONS.appointment.y },
    ];

    const newViewEdges: ViewEdge[] = [
      { id: crypto.randomUUID(), relationId: rel1Id, waypoints: [],
        sourceMultiplicity: "1", targetMultiplicity: "*" },
      { id: crypto.randomUUID(), relationId: rel2Id, waypoints: [],
        sourceMultiplicity: "1", targetMultiplicity: "*" },
    ];

    updateFileContent(activeTabId, {
      ...currentView,
      nodes: [...currentView.nodes, ...newViewNodes],
      edges: [...currentView.edges, ...newViewEdges],
    });
  }, [activeTabId, updateFileContent]);

  return { loadTemplate };
}
