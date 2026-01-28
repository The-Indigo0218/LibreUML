import { useCallback } from "react";

export const useAppLifecycle = () => {
  // --- ACTIONS ---
  const quitApplication = useCallback(() => {
    if (window.electronAPI?.isElectron()) {
      window.electronAPI?.sendForceClose(); 
    } else {
      console.warn("Exit requested (Web Mode)");
      window.close(); 
    }
  }, []);

  return {
    quitApplication, 
  };
};