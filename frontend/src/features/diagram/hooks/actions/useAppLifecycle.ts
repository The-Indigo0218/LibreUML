import { useEffect, useCallback } from "react";

interface UseAppLifecycleProps {
  executeSafeAction: (action: () => void | Promise<void>) => void;
}

export const useAppLifecycle = ({
  executeSafeAction,
}: UseAppLifecycleProps) => {
  // --- LISTENERS ---

  useEffect(() => {
    if (!window.electronAPI?.isElectron()) return;

    const unsubscribe = window.electronAPI.onAppRequestClose(() => {
      executeSafeAction(() => {
        window.electronAPI?.sendForceClose();
      });
    });

    return () => unsubscribe();
  }, [executeSafeAction]);

  // --- ACTIONS ---

  const handleExit = useCallback(() => {
    if (window.electronAPI?.isElectron()) {
      executeSafeAction(() => {
        window.electronAPI?.close();
      });
    }
  }, [executeSafeAction]);

  return {
    handleExit,
  };
};
