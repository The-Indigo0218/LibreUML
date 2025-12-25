// src/features/diagram/components/DiagramCanvas.tsx
import { useState, useCallback } from 'react';
import ReactFlow, { Background, Controls, useReactFlow, type Node } from 'reactflow';
import 'reactflow/dist/style.css';
import { useDiagramStore } from '../../../store/diagramStore';
import type { UmlClassData } from '../../../types/diagram.types';
import UmlClassNode from './UmlClassNode';
import ContextMenu from './ContextMenu';

const nodeTypes = { umlClass: UmlClassNode };

export default function DiagramCanvas() {
  const { 
    nodes, edges, onNodesChange, onEdgesChange, onConnect, 
    addNode, deleteNode, duplicateNode, clearCanvas 
  } = useDiagramStore();

  const { screenToFlowPosition } = useReactFlow();
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

  const menuOptions = menu?.type === 'pane' 
    ? [
        { 
          label: 'Add Class', 
          onClick: () => addNode(screenToFlowPosition({ x: menu.x, y: menu.y })) 
        },
        { 
          label: 'Clean Canvas', 
          onClick: () => clearCanvas(), 
          danger: true 
        },
      ]
    : [
        { 
          label: 'Duplicate', 
          onClick: () => { if (menu?.nodeId) duplicateNode(menu.nodeId); } 
        },
        { 
          label: 'Delete', 
          onClick: () => { if (menu?.nodeId) deleteNode(menu.nodeId); }, 
          danger: true 
        },
      ];

  return (
    <div className="w-screen h-screen bg-gray-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={closeMenu}
        fitView
      >
        <Background/>
        <Controls />
      </ReactFlow>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} options={menuOptions} onClose={closeMenu} />
      )}
    </div>
  );
}