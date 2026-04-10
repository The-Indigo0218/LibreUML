import { useState, useCallback } from "react";

type MenuState = {
  type: "node" | "edge" | "pane";
  x: number;
  y: number;
  id?: string; 
} | null;

/**
 * Generic context element (RF-free)
 * Used for node/edge context menu handlers
 */
export interface ContextElement {
  id: string;
  type?: string;
  data?: any;
}

export function useContextMenu() {
  const [menu, setMenu] = useState<MenuState>(null);

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    const clientX = 'clientX' in event ? event.clientX : 0;
    const clientY = 'clientY' in event ? event.clientY : 0;
    setMenu({
      type: "pane",
      x: clientX,
      y: clientY,
    });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent | MouseEvent, element: ContextElement) => {
    event.preventDefault();
    event.stopPropagation(); 
    const clientX = 'clientX' in event ? event.clientX : 0;
    const clientY = 'clientY' in event ? event.clientY : 0;
    setMenu({
      type: "node",
      x: clientX,
      y: clientY,
      id: element.id,
    });
  }, []);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent | MouseEvent, element: ContextElement) => {
    event.preventDefault();
    event.stopPropagation(); 
    const clientX = 'clientX' in event ? event.clientX : 0;
    const clientY = 'clientY' in event ? event.clientY : 0;
    setMenu({
      type: "edge",
      x: clientX,
      y: clientY,
      id: element.id,
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