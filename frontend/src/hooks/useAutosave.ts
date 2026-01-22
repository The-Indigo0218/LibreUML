import { useEffect } from 'react';
import { useDiagramStore } from '../store/diagramStore';
import { useReactFlow } from 'reactflow';
import type { DiagramState, UmlClassNode, UmlEdge } from '../features/diagram/types/diagram.types';

const AUTOSAVE_INTERVAL = 30 * 1000; 
const STORAGE_KEY = 'libreuml-backup';

export const useAutosave = () => {
  const { toObject } = useReactFlow();
  
  // Use getState to read without re-rendering (optimization)
  const storeApi = useDiagramStore.getState;

  useEffect(() => {
    const timer = setInterval(() => {
      const { isDirty, diagramId, diagramName, currentFilePath } = storeApi();

      // LOGIC: If not dirty OR no real file assigned, skip autosave.
      if (!isDirty || !currentFilePath) {
        return;
      }

      console.log('🔄 Executing Autosave (Only for existing file)...');
      
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
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(timer);
  }, [storeApi, toObject]); 
};