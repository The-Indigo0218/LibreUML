import { useEffect, useRef } from "react";
import { useReactFlow } from "reactflow";
import { useDiagramStore } from "../store/diagramStore";
import { useSettingsStore } from "../store/settingsStore";

const STORAGE_KEY = 'libreuml-backup';
const BACKUP_DELAY = 3000; 

export const useAutoSave = () => {
  const { toObject } = useReactFlow();
  const autoSaveEnabled = useSettingsStore((s) => s.autoSave);
  

  const isDirty = useDiagramStore((s) => s.isDirty);
  const diagramId = useDiagramStore((s) => s.diagramId); 
  
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!autoSaveEnabled || !isDirty) {
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      const flow = toObject(); 
      
      const state = useDiagramStore.getState();

      const backupData = {
        id: state.diagramId,
        name: state.diagramName,
        currentFilePath: state.currentFilePath,
        nodes: flow.nodes,
        edges: flow.edges,
        viewport: flow.viewport,
        timestamp: Date.now()
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(backupData));
        console.log("[AutoSave] Backup actualizado en LocalStorage", new Date().toLocaleTimeString());
      } catch (e) {
        console.warn("[AutoSave] Error guardando backup (posiblemente cuota llena)", e);
      }
    }, BACKUP_DELAY);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isDirty, diagramId, autoSaveEnabled, toObject]);
};