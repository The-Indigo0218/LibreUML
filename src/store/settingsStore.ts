import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n from "../i18n/config";

interface SettingsState {
  // --- preferences ---
  autoSave: boolean;
  restoreSession: boolean;
  theme: "light" | "dark" | "system"; 
  language: string;
  suppressSvgWarning: boolean;
  
  // --- inside state  ---
  lastFilePath?: string; 
  
  // --- actions ---
  toggleAutoSave: () => void;
  toggleRestoreSession: () => void;
  setTheme: (theme: "light" | "dark") => void;
  setLanguage: (lang: string) => void;
  setLastFilePath: (path: string | undefined) => void;
  setSuppressSvgWarning: (suppress: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoSave: false, 
      restoreSession: false,
      theme: "dark", 
      language: "en",
      suppressSvgWarning: false,
      lastFilePath: undefined,

      toggleAutoSave: () => set((s) => ({ autoSave: !s.autoSave })),
      
      toggleRestoreSession: () => set((s) => ({ restoreSession: !s.restoreSession })),
      
      setTheme: (theme) => set({ theme }),
      
      setLanguage: (lang) => {
        i18n.changeLanguage(lang); 
        set({ language: lang });
      },

      setSuppressSvgWarning: (suppress) => set({ suppressSvgWarning: suppress }),

      setLastFilePath: (path) => set({ lastFilePath: path }),
    }),
    {
      name: "libreuml-settings",
      partialize: (state) => ({
        autoSave: state.autoSave,
        restoreSession: state.restoreSession,
        theme: state.theme,
        language: state.language,
        lastFilePath: state.lastFilePath,
        suppressSvgWarning: state.suppressSvgWarning,
      }),
    }
  )
);