import { useState, useEffect, useMemo, useCallback } from "react";
import { useReactFlow } from "reactflow";
import { create } from "zustand";
import { useDiagramStore } from "../../../store/diagramStore";

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
  const { fitView } = useReactFlow();
  
  const nodes = useDiagramStore((state) => state.nodes);

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
      const label = node.data.label?.toLowerCase() || "";
      const content = node.data.content?.toLowerCase() || "";
      const term = searchTerm.toLowerCase();
      
      return label.includes(term) || content.includes(term);
    });
  }, [nodes, searchTerm]);

  const onSelectNode = useCallback((nodeId: string) => {
    const targetNode = nodes.find((n) => n.id === nodeId);
    if (!targetNode) return;

    fitView({
      nodes: [targetNode],
      duration: 800,
      padding: 1.5,
    });
    
    setIsOpen(false);
  }, [fitView, nodes, setIsOpen]);

  return {
    isOpen,
    setIsOpen,
    searchTerm,
    setSearchTerm,
    filteredNodes,
    onSelectNode,
  };
};