import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useVFSStore } from "../../../../store/vfs.store";
import type { LibreUMLProject, VFSFolder, VFSFile } from "../../../../core/domain/vfs/vfs.types";

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const { loadProject } = useVFSStore();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    const now = Date.now();
    const projectId = crypto.randomUUID();
    const modelFileId = crypto.randomUUID();
    const diagramsFolderId = crypto.randomUUID();
    const mainDiagramId = crypto.randomUUID();

    const modelFile: VFSFile = {
      id: modelFileId,
      name: "domain.model",
      type: "FILE",
      parentId: null,
      diagramType: "UNSPECIFIED",
      extension: ".model",
      isExternal: false,
      content: null,
      createdAt: now,
      updatedAt: now,
    };

    const diagramsFolder: VFSFolder = {
      id: diagramsFolderId,
      name: "diagrams",
      type: "FOLDER",
      parentId: null,
      createdAt: now,
      updatedAt: now,
    };

    const mainDiagram: VFSFile = {
      id: mainDiagramId,
      name: "Main Diagram",
      type: "FILE",
      parentId: diagramsFolderId,
      diagramType: "CLASS_DIAGRAM",
      extension: ".luml",
      isExternal: false,
      content: {
        diagramId: mainDiagramId,
        nodes: [],
        edges: [],
      },
      createdAt: now,
      updatedAt: now,
    };

    const project: LibreUMLProject = {
      id: projectId,
      projectName: projectName.trim(),
      description: description.trim() || undefined,
      version: "1.0.0",
      domainModelId: modelFileId,
      nodes: {
        [modelFileId]: modelFile,
        [diagramsFolderId]: diagramsFolder,
        [mainDiagramId]: mainDiagram,
      },
      createdAt: now,
      updatedAt: now,
    };

    loadProject(project);
    setProjectName("");
    setDescription("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };

  if (!isOpen) return null;

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
          <h2 className="text-xl font-semibold text-[#e2e8f0]">Create New Project</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#1e2738] rounded transition-colors"
          >
            <X className="w-5 h-5 text-[#94a3b8] hover:text-[#e2e8f0]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="projectName" className="block text-sm font-medium text-[#cbd5e1] mb-2">
              Project Name <span className="text-red-400">*</span>
            </label>
            <input
              ref={inputRef}
              id="projectName"
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="My UML Project"
              className="w-full px-3 py-2 bg-[#0f1419] border border-[#2a3358] rounded-lg text-[#e2e8f0] placeholder-[#64748b] focus:outline-none focus:ring-2 focus:ring-[#7C83FF]"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[#cbd5e1] mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional project description"
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
              disabled={!projectName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-[#374151] disabled:text-[#9ca3af] disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
