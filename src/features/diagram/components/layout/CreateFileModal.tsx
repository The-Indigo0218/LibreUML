import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Layers,
  Users,
  ArrowRightLeft,
  Activity,
  GitBranch,
  Puzzle,
  Server,
  Package,
  Database,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useVFSStore } from "../../../../store/project-vfs.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import { useToastStore } from "../../../../store/toast.store";
import type { DiagramType, VFSFolder, VFSFile } from "../../../../core/domain/vfs/vfs.types";

interface DiagramTypeConfig {
  type: DiagramType;
  label: string;
  icon: LucideIcon;
  enabled: boolean;
}

const DIAGRAM_TYPE_CONFIG: DiagramTypeConfig[] = [
  { type: "CLASS_DIAGRAM",         label: "Class",      icon: Layers,          enabled: true  },
  { type: "USE_CASE_DIAGRAM",      label: "Use Case",   icon: Users,           enabled: false },
  { type: "SEQUENCE_DIAGRAM",      label: "Sequence",   icon: ArrowRightLeft,  enabled: false },
  { type: "ACTIVITY_DIAGRAM",      label: "Activity",   icon: Activity,        enabled: false },
  { type: "STATE_MACHINE_DIAGRAM", label: "State",      icon: GitBranch,       enabled: false },
  { type: "COMPONENT_DIAGRAM",     label: "Component",  icon: Puzzle,          enabled: false },
  { type: "DEPLOYMENT_DIAGRAM",    label: "Deployment", icon: Server,          enabled: false },
  { type: "PACKAGE_DIAGRAM",       label: "Package",    icon: Package,         enabled: false },
  { type: "OBJECT_DIAGRAM",        label: "Object",     icon: Database,        enabled: false },
];

interface CreateFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
  editNodeId?: string;
  initialParentId?: string | null;
}

export default function CreateFileModal({
  isOpen,
  onClose,
  parentId,
  editNodeId,
  initialParentId,
}: CreateFileModalProps) {
  const [fileName, setFileName] = useState("");
  const [diagramType, setDiagramType] = useState<DiagramType>("CLASS_DIAGRAM");
  const [description, setDescription] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(
    initialParentId ?? parentId ?? null,
  );
  const [standalone, setStandalone] = useState(false);
  const [validationError, setValidationError] = useState("");

  const { project, createFile, updateNode } = useVFSStore();
  const { openTab } = useWorkspaceStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editNodeId && project) {
      const node = project.nodes[editNodeId];
      if (node && node.type === "FILE") {
        setFileName(node.name);
        setDiagramType(node.diagramType);
        setDescription(node.description || "");
        setSelectedParentId(node.parentId);
      }
    } else {
      setFileName("");
      setDiagramType("CLASS_DIAGRAM");
      setDescription("");
      setSelectedParentId(initialParentId ?? parentId ?? null);
      setStandalone(false);
    }
    setValidationError("");
  }, [editNodeId, project, isOpen, initialParentId, parentId]);

  const validateUniqueness = (): boolean => {
    if (!project) return true;

    const targetParentId = selectedParentId === "root" ? null : selectedParentId;
    const fullFileName = `${fileName.trim()}.luml`;

    const siblings = Object.values(project.nodes).filter(
      (node) => node.parentId === targetParentId && node.id !== editNodeId,
    );

    const conflict = siblings.find(
      (sibling) =>
        sibling.type === "FILE" &&
        `${sibling.name}${sibling.extension}` === fullFileName,
    );

    if (conflict) {
      setValidationError("A file with this name already exists in this location");
      return false;
    }

    setValidationError("");
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim()) return;
    if (!validateUniqueness()) return;

    const targetParentId = standalone ? null : (selectedParentId === "root" ? null : selectedParentId);

    if (editNodeId) {
      updateNode(editNodeId, {
        name: fileName.trim(),
        description: description.trim() || undefined,
        parentId: targetParentId,
        diagramType,
      });
    } else {
      const newFileId = createFile(
        targetParentId,
        fileName.trim(),
        diagramType,
        ".luml",
        false,
        standalone,
      );
      openTab(newFileId);
      useToastStore.getState().show(`"${fileName.trim()}" created`);
    }

    setFileName("");
    setDiagramType("CLASS_DIAGRAM");
    setDescription("");
    setStandalone(false);
    setValidationError("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const getFullPath = (
    nodeId: string,
    nodes: Record<string, VFSFolder | VFSFile>,
  ): string => {
    const path: string[] = [];
    let currentId: string | null = nodeId;

    while (currentId !== null) {
      const currentNode: VFSFolder | VFSFile | undefined = nodes[currentId];
      if (!currentNode) break;
      path.unshift(currentNode.name);
      currentId = currentNode.parentId;
    }

    return "/" + path.join("/");
  };

  const folders = project
    ? Object.values(project.nodes)
        .filter((node) => node.type === "FOLDER")
        .map((folder) => ({
          id: folder.id,
          name: folder.name,
          path: getFullPath(folder.id, project.nodes),
        }))
        .sort((a, b) => a.path.localeCompare(b.path))
    : [];

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#161d2f] border border-[#2a3358] shadow-2xl rounded-lg w-full max-w-md relative z-[10000] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between p-6 pb-4 shrink-0">
          <h2 className="text-xl font-semibold text-[#e2e8f0]">
            {editNodeId ? "Edit Diagram" : "Create New Diagram"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#1e2738] rounded transition-colors"
          >
            <X className="w-5 h-5 text-[#94a3b8] hover:text-[#e2e8f0]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto px-6 pb-4 space-y-4">
          <div>
            <label
              htmlFor="fileName"
              className="block text-sm font-medium text-[#cbd5e1] mb-2"
            >
              File Name <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                id="fileName"
                type="text"
                value={fileName}
                onChange={(e) => {
                  setFileName(e.target.value);
                  setValidationError("");
                }}
                placeholder="MyDiagram"
                className={`flex-1 px-3 py-2 bg-[#0f1419] border rounded-lg text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:ring-2 ${
                  validationError
                    ? "border-red-500 focus:ring-red-500"
                    : "border-[#2a3358] focus:ring-[#7C83FF]"
                }`}
              />
              <span className="text-sm font-medium text-[#94a3b8]">.luml</span>
            </div>
            {validationError && (
              <p className="text-xs text-red-400 mt-1">{validationError}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="location"
              className="block text-sm font-medium text-[#cbd5e1] mb-2"
            >
              Location <span className="text-red-400">*</span>
            </label>
            <select
              id="location"
              value={standalone ? "root" : (selectedParentId || "root")}
              onChange={(e) => {
                if (standalone) return;
                setSelectedParentId(
                  e.target.value === "root" ? null : e.target.value,
                );
                setValidationError("");
              }}
              disabled={standalone}
              className={`w-full px-3 py-2 bg-[#0f1419] border border-[#2a3358] rounded-lg text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#7C83FF] ${standalone ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <option value="root">/</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.path}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
              Diagram Type <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DIAGRAM_TYPE_CONFIG.map(({ type, label, icon: Icon, enabled }) => {
                const isSelected = diagramType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={!enabled}
                    onClick={() => setDiagramType(type)}
                    className={[
                      "relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-lg border transition-all text-center select-none",
                      enabled
                        ? isSelected
                          ? "border-[#7C83FF] bg-[#7C83FF]/10 text-[#e2e8f0] cursor-pointer"
                          : "border-[#2a3358] bg-[#0f1419] text-[#94a3b8] hover:border-[#3d4a6e] hover:text-[#cbd5e1] cursor-pointer"
                        : "border-[#1a2235] bg-[#0c1018] text-[#2a3a52] cursor-not-allowed",
                    ].join(" ")}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-[10px] font-medium leading-tight">
                      {label}
                    </span>
                    {!enabled && (
                      <span className="absolute -top-1.5 -right-1.5 text-[8px] font-bold uppercase tracking-wide text-amber-500/80 bg-[#1a1400] border border-amber-500/25 rounded-sm px-1 py-px leading-none">
                        Soon
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-[#cbd5e1] mb-2"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional diagram description"
              rows={3}
              className="w-full px-3 py-2 bg-[#0f1419] border border-[#2a3358] rounded-lg text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#7C83FF] resize-none"
            />
          </div>
          {!editNodeId && (
            <div className="flex items-start gap-3 px-3 py-3 rounded-lg border border-[#2a3358] bg-[#0f1419]">
              <button
                id="standalone"
                type="button"
                role="switch"
                aria-checked={standalone}
                onClick={() => setStandalone((v) => !v)}
                className={`relative mt-0.5 shrink-0 w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#7C83FF] ${
                  standalone ? "bg-[#7C83FF]" : "bg-[#2a3358]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    standalone ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <div className="flex flex-col gap-0.5">
                <label
                  htmlFor="standalone"
                  className="text-sm font-medium text-[#cbd5e1] cursor-pointer select-none"
                  onClick={() => setStandalone((v) => !v)}
                >
                  Standalone File
                </label>
                <p className="text-xs text-[#64748b] leading-snug">
                  Isolates this diagram from the shared workspace model. The
                  global Model Explorer will be hidden while this file is active.
                </p>
              </div>
            </div>
          )}
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#2a3358] shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#cbd5e1] bg-[#1e2738] hover:bg-[#2a3358] hover:text-[#e2e8f0] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!fileName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-[#374151] disabled:text-[#9ca3af] disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {editNodeId ? "Save Changes" : "Create Diagram"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
