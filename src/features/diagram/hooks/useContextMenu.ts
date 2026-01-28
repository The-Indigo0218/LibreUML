import { useState, useCallback } from "react";
import { type Node, type Edge } from "reactflow";

type MenuState = {
  type: "node" | "edge" | "pane";
  x: number;
  y: number;
  id?: string; 
} | null;

export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState>(null);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setMenu({
      type: "pane",
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    event.stopPropagation(); 
    setMenu({
      type: "node",
      x: event.clientX,
      y: event.clientY,
      id: node.id,
    });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    event.stopPropagation(); 
    setMenu({
      type: "edge",
      x: event.clientX,
      y: event.clientY,
      id: edge.id,
    });
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  return { 
    menu, 
    onPaneContextMenu, 
    onNodeContextMenu, 
    onEdgeContextMenu, 
    closeMenu 
  };
}