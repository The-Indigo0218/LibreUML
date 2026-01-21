import { useEffect } from 'react';
import { useDiagramStore } from '../store/diagramStore';
import {  useReactFlow } from 'reactflow';
import type { DiagramState, UmlClassNode, UmlEdge } from '../features/diagram/types/diagram.types';

const AUTOSAVE_INTERVAL = 30 * 1000; 
const STORAGE_KEY = 'libreuml-backup';

export const useAutosave = () => {
  const { toObject } = useReactFlow();
  const isDirty = useDiagramStore((state) => state.isDirty);
  const diagramId = useDiagramStore((state) => state.diagramId);
  const diagramName = useDiagramStore((state) => state.diagramName);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isDirty) {
        console.log('🔄 Ejecutando Autosave de Emergencia...');
        
        const flowObject = toObject();
        
        const cleanEdges = flowObject.edges.map((edge) => {
            const { ...semanticEdge } = edge;
            return semanticEdge;
        });

        const backupData: DiagramState = {
            id: diagramId,
            name: diagramName,
            nodes: flowObject.nodes as unknown as UmlClassNode[],
            edges: cleanEdges as unknown as UmlEdge[],
            viewport: flowObject.viewport
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(backupData));
        localStorage.setItem(STORAGE_KEY + '-timestamp', new Date().toISOString());
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(timer);
  }, [isDirty, diagramId, diagramName, toObject]);
};