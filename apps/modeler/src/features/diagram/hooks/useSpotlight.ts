import { useState, useEffect, useMemo, useCallback } from "react";
import { create } from "zustand";
import { useViewportControlStore } from "../../../canvas/store/viewportControlStore";
import { useWorkspaceStore } from "../../../store/workspace.store";
import { useVFSStore } from "../../../store/project-vfs.store";
import { useModelStore } from "../../../store/model.store";
import { isDiagramView } from "./useVFSCanvasController";
import type { VFSFile } from "../../../core/domain/vfs/vfs.types";

interface SpotlightState {
  isOpen: boolean;
  toggle: () => void;
  setIsOpen: (open: boolean) => void;
}

export const useSpotlightStore = create<SpotlightState>((set) => ({
  isOpen: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  setIsOpen: (open) => set({ isOpen: open }),
}));

export const useSpotlight = () => {
  const { isOpen, setIsOpen } = useSpotlightStore();
  const [searchTerm, setSearchTerm] = useState("");
  const fitView = useViewportControlStore((s) => s.fitView);

  const activeTabId = useWorkspaceStore((s) => s.activeTabId);
  const project = useVFSStore((s) => s.project);
  const globalModel = useModelStore((s) => s.model);

  const nodes = useMemo(() => {
    if (!activeTabId || !project) return [];
    const vfsNode = project.nodes[activeTabId];
    if (!vfsNode || vfsNode.type !== 'FILE') return [];
    const vfsFile = vfsNode as VFSFile;
    if (!isDiagramView(vfsFile.content)) return [];

    const view = vfsFile.content;
    const model = vfsFile.localModel ?? globalModel;

    return view.nodes.flatMap((viewNode) => {
      const { elementId } = viewNode;

      if (model) {
        if (model.classes[elementId])
          return [{ id: viewNode.id, name: model.classes[elementId].name, type: 'CLASS' }];
        if (model.interfaces[elementId])
          return [{ id: viewNode.id, name: model.interfaces[elementId].name, type: 'INTERFACE' }];
        if (model.enums[elementId])
          return [{ id: viewNode.id, name: model.enums[elementId].name, type: 'ENUM' }];
        if (model.actors?.[elementId])
          return [{ id: viewNode.id, name: model.actors[elementId].name, type: 'ACTOR' }];
        if (model.useCases?.[elementId])
          return [{ id: viewNode.id, name: model.useCases[elementId].name, type: 'USE_CASE' }];
        if (model.systemBoundaries?.[elementId])
          return [{ id: viewNode.id, name: model.systemBoundaries[elementId].name, type: 'SYSTEM_BOUNDARY' }];
        if (model.ucModules?.[elementId])
          return [{ id: viewNode.id, name: model.ucModules[elementId].name, type: 'UC_MODULE' }];
        if (model.domainEntities?.[elementId])
          return [{ id: viewNode.id, name: model.domainEntities[elementId].name, type: 'ENTITY' }];
      }

      if (viewNode.packageName)
        return [{ id: viewNode.id, name: viewNode.packageName, type: 'PACKAGE' }];
      if (viewNode.content)
        return [{ id: viewNode.id, name: viewNode.noteTitle || viewNode.content.slice(0, 40) || 'Note', type: 'NOTE' }];

      return [];
    });
  }, [activeTabId, project, globalModel]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(!isOpen); 
        if (!isOpen) setSearchTerm(""); 
      }
      
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, setIsOpen]);

  const filteredNodes = useMemo(() => {
    if (!searchTerm) return nodes;
    
    return nodes.filter((node) => {
      const name = node.name?.toLowerCase() || "";
      const type = node.type?.toLowerCase() || "";
      const term = searchTerm.toLowerCase();
      
      return name.includes(term) || type.includes(term);
    });
  }, [nodes, searchTerm]);

  const onSelectNode = useCallback((_nodeId: string) => {
    // Fits all content; node-specific scroll is a future enhancement
    fitView();
    setIsOpen(false);
  }, [fitView, setIsOpen]);

  return {
    isOpen,
    setIsOpen,
    searchTerm,
    setSearchTerm,
    filteredNodes,
    onSelectNode,
  };
};