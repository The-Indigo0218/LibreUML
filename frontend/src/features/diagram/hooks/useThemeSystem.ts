import { useEffect } from "react";
import { useThemeStore } from "../../../store/themeStore";

export const useThemeSystem = () => {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);

  useEffect(() => {
    const root = window.document.documentElement;

    if (isDarkMode) {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.style.colorScheme = "light";
    }
    
  }, [isDarkMode]);
};