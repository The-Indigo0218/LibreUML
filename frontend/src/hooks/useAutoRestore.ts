import { useEffect, useRef } from 'react';
import { useReactFlow } from 'reactflow';
import { useDiagramStore } from '../store/diagramStore';
import { useSettingsStore } from '../store/settingsStore';

const STORAGE_KEY = 'libreuml-backup';

export const useAutoRestore = () => {
  const { setViewport } = useReactFlow();
  const loadDiagram = useDiagramStore((state) => state.loadDiagram);
  const setFilePath = useDiagramStore((state) => state.setFilePath);
  const setDirty = useDiagramStore((state) => state.setDirty);
  
  const restoreSessionEnabled = useSettingsStore((state) => state.restoreSession);
  
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!restoreSessionEnabled) return;

    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      
      if (savedData) {
        console.log("♻️ Restaurando sesión desde backup...");
        const parsedData = JSON.parse(savedData);

        loadDiagram({
            id: parsedData.id,
            name: parsedData.name,
            nodes: parsedData.nodes,
            edges: parsedData.edges,
            viewport: parsedData.viewport || { x: 0, y: 0, zoom: 1 } 
        }, true);

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
  }, [loadDiagram, setViewport, setFilePath, setDirty, restoreSessionEnabled]);
};