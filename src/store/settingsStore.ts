import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n from "../i18n/config";
import { storageAdapter } from "../adapters/storage/storage.adapter";

interface SettingsState {
  autoSave: boolean;
  restoreSession: boolean;
  theme: "light" | "dark" | "system";
  language: string;
  suppressSvgWarning: boolean;
  hideDuplicateFileWarning: boolean;
  showMiniMap: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  showAllEdges: boolean;
  lastFilePath?: string;

  toggleAutoSave: () => void;
  toggleRestoreSession: () => void;
  setTheme: (theme: "light" | "dark") => void;
  setLanguage: (lang: string) => void;
  setLastFilePath: (path: string | undefined) => void;
  setSuppressSvgWarning: (suppress: boolean) => void;
  setHideDuplicateFileWarning: (hide: boolean) => void;
  toggleMiniMap: () => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  toggleShowAllEdges: () => void;
  resetAllModalPreferences: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoSave: false,
      restoreSession: false,
      theme: "dark",
      language: "en",
      suppressSvgWarning: false,
      hideDuplicateFileWarning: false,
      lastFilePath: undefined,
      showMiniMap: false,
      showGrid: true,
      snapToGrid: true,
      showAllEdges: false,

      toggleAutoSave: () => set((s) => ({ autoSave: !s.autoSave })),
      toggleRestoreSession: () => set((s) => ({ restoreSession: !s.restoreSession })),
      setTheme: (theme) => set({ theme }),
      setLanguage: (lang) => {
        i18n.changeLanguage(lang);
        set({ language: lang });
      },
      setSuppressSvgWarning: (suppress) => set({ suppressSvgWarning: suppress }),
      setHideDuplicateFileWarning: (hide) => set({ hideDuplicateFileWarning: hide }),
      setLastFilePath: (path) => set({ lastFilePath: path }),
      toggleMiniMap: () => set((s) => ({ showMiniMap: !s.showMiniMap })),
      toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
      toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
      toggleShowAllEdges: () => set((s) => ({ showAllEdges: !s.showAllEdges })),
      resetAllModalPreferences: () => {
        set({
          suppressSvgWarning: false,
          hideDuplicateFileWarning: false,
        });
        try {
          localStorage.removeItem('libreuml-suppress-close-project-warning');
          localStorage.removeItem('libreuml-auto-layout-locked-warning');
        } catch (e) {
          console.error('Failed to clear modal preferences:', e);
        }
      },
    }),
    {
      name: "libreuml-settings",
      storage: {
        getItem: (name) => {
          const value = storageAdapter.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          storageAdapter.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          storageAdapter.removeItem(name);
        },
      },
    }
  )
);