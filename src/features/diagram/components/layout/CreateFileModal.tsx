import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useVFSStore } from "../../../../store/vfs.store";
import { useWorkspaceStore } from "../../../../store/workspace.store";
import type { DiagramType, VFSFolder, VFSFile } from "../../../../core/domain/vfs/vfs.types";

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
  initialParentId 
}: CreateFileModalProps) {
  const [fileName, setFileName] = useState("");
  const [diagramType, setDiagramType] = useState<DiagramType>("CLASS_DIAGRAM");
  const [description, setDescription] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(initialParentId ?? parentId ?? null);
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
    }
    setValidationError("");
  }, [editNodeId, project, isOpen, initialParentId, parentId]);

  const validateUniqueness = (): boolean => {
    if (!project) return true;

    const targetParentId = selectedParentId === "root" ? null : selectedParentId;
    const fullFileName = `${fileName.trim()}.luml`;

    const siblings = Object.values(project.nodes).filter(
      (node) => node.parentId === targetParentId && node.id !== editNodeId
    );

    const conflict = siblings.find(
      (sibling) => sibling.type === "FILE" && `${sibling.name}${sibling.extension}` === fullFileName
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

    const targetParentId = selectedParentId === "root" ? null : selectedParentId;

    if (editNodeId) {
      updateNode(editNodeId, {
        name: fileName.trim(),
        description: description.trim() || undefined,
        parentId: targetParentId,
        diagramType,
      });
    } else {
      const newFileId = createFile(targetParentId, fileName.trim(), diagramType, ".luml", false);
      openTab(newFileId);
    }
    
    setFileName("");
    setDiagramType("CLASS_DIAGRAM");
    setDescription("");
    setValidationError("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

  const diagramTypes: DiagramType[] = [
    "CLASS_DIAGRAM",
    "USE_CASE_DIAGRAM",
    "SEQUENCE_DIAGRAM",
    "ACTIVITY_DIAGRAM",
    "STATE_MACHINE_DIAGRAM",
    "COMPONENT_DIAGRAM",
    "DEPLOYMENT_DIAGRAM",
    "PACKAGE_DIAGRAM",
    "OBJECT_DIAGRAM",
  ];

  const getFullPath = (nodeId: string, nodes: Record<string, VFSFolder | VFSFile>): string => {
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-[#161d2f] border border-[#2a3358] shadow-2xl rounded-lg w-full max-w-md relative z-[10000] p-6"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-6">
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fileName" className="block text-sm font-medium text-[#cbd5e1] mb-2">
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
            <label htmlFor="location" className="block text-sm font-medium text-[#cbd5e1] mb-2">
              Location <span className="text-red-400">*</span>
            </label>
            <select
              id="location"
              value={selectedParentId || "root"}
              onChange={(e) => {
                setSelectedParentId(e.target.value === "root" ? null : e.target.value);
                setValidationError("");
              }}
              className="w-full px-3 py-2 bg-[#0f1419] border border-[#2a3358] rounded-lg text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#7C83FF]"
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
            <label htmlFor="diagramType" className="block text-sm font-medium text-[#cbd5e1] mb-2">
              Diagram Type <span className="text-red-400">*</span>
            </label>
            <select
              id="diagramType"
              value={diagramType}
              onChange={(e) => setDiagramType(e.target.value as DiagramType)}
              className="w-full px-3 py-2 bg-[#0f1419] border border-[#2a3358] rounded-lg text-[#e2e8f0] focus:outline-none focus:ring-2 focus:ring-[#7C83FF]"
            >
              {diagramTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[#cbd5e1] mb-2">
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

          <div className="flex items-center justify-end gap-3 pt-4">
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
