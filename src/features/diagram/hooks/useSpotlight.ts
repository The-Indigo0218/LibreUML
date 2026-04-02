import { useState, useEffect, useMemo, useCallback } from "react";
import { create } from "zustand";
import { useViewportControlStore } from "../../../canvas/store/viewportControlStore";
import { useProjectStore } from "../../../store/project.store";
import { useWorkspaceStore } from "../../../store/workspace.store";

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
  
  // Read from SSOT: get active file's node IDs, then get domain nodes
  const activeFileId = useWorkspaceStore((s) => s.activeFileId);
  const getFile = useWorkspaceStore((s) => s.getFile);
  const projectNodes = useProjectStore((s) => s.nodes);

  const file = activeFileId ? getFile(activeFileId) : undefined;
  
  // Build a lightweight node list for spotlight search
  const nodes = useMemo(() => {
    if (!file) return [];
    return file.nodeIds
      .map((id) => projectNodes[id])
      .filter(Boolean)
      .map((node) => ({
        id: node.id,
        name: (node as any).name || (node as any).label || (node as any).content || 'Unnamed Node',
        type: node.type,
      }));
  }, [file, projectNodes]);

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