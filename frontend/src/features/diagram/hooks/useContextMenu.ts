// src/features/diagram/hooks/useContextMenu.ts
import { useState, useCallback } from 'react';
import type { Node } from 'reactflow';
import type { UmlClassData } from '../../../types/diagram.types';

export function useContextMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; type: 'pane' | 'node'; nodeId?: string } | null>(null);

  const onPaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, type: 'pane' });
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node<UmlClassData>) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, type: 'node', nodeId: node.id });
  }, []);

  const closeMenu = () => setMenu(null);

  return { menu, onPaneContextMenu, onNodeContextMenu, closeMenu };
}