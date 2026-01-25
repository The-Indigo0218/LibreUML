import { useEffect } from "react";
import { useSettingsStore } from "../store/settingsStore"; // <--- IMPORTANTE: Usamos el nuevo store

export const useThemeSystem = () => {
  // Conectamos directamente al Settings Store
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    const root = window.document.documentElement;

    if (theme === "dark") {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
    
  }, [theme]);
};