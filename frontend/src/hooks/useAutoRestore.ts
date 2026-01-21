import { useEffect, useRef } from 'react';
import { useDiagramStore } from '../store/diagramStore';
import { useReactFlow } from 'reactflow';
import type { DiagramState } from '../features/diagram/types/diagram.types';

const STORAGE_KEY = 'libreuml-backup';

export const useAutoRestore = () => {
  const { setViewport } = useReactFlow();
  const loadDiagram = useDiagramStore((state) => state.loadDiagram);
  const setFilePath = useDiagramStore((state) => state.setFilePath);
  const setDirty = useDiagramStore((state) => state.setDirty);
  
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      
      if (savedData) {
        console.log("♻️ Restaurando sesión anterior...");
        const parsedData = JSON.parse(savedData) as DiagramState & { currentFilePath?: string };

        loadDiagram(parsedData);

        if (parsedData.viewport) {
          const { x, y, zoom } = parsedData.viewport;
          setViewport({ x, y, zoom });
        }

        if (parsedData.currentFilePath && window.electronAPI?.isElectron()) {
            setFilePath(parsedData.currentFilePath);
        }

        setDirty(true); 
      }
    } catch (error) {
      console.error("Error restaurando sesión:", error);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [loadDiagram, setViewport, setFilePath, setDirty]);
};