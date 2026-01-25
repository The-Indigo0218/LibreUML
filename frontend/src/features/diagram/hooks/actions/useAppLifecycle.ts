import { useEffect, useCallback } from "react";

export const useAppLifecycle = () => {
  // --- LISTENERS ---
  useEffect(() => {
    if (!window.electronAPI?.isElectron()) return;
  }, []);

  // --- ACTIONS ---
  const handleExit = useCallback(() => {
    if (window.electronAPI?.isElectron()) {
      window.electronAPI?.close();
    } else {
      console.warn("Exit requested (Web Mode)");
    }
  }, []);

  return {
    handleExit,
  };
};