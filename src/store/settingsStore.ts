import { create } from "zustand";
import { persist } from "zustand/middleware";
import i18n from "../i18n/config";
import { storageAdapter } from "../adapters/storage/storage.adapter";

export type GridType = 'none' | 'dots' | 'lines' | 'grid';

const GRID_CYCLE: GridType[] = ['dots', 'lines', 'grid', 'none'];

interface SettingsState {
  autoSave: boolean;
  restoreSession: boolean;
  theme: "light" | "dark" | "system";
  language: string;
  suppressSvgWarning: boolean;
  hideDuplicateFileWarning: boolean;
  javaImportPreference: 'model' | 'canvas' | 'both' | null;
  showMiniMap: boolean;
  gridType: GridType;
  viewportCulling: boolean;
  suppressCullingWarning: boolean;
  snapToGrid: boolean;
  showAllEdges: boolean;
  lastFilePath?: string;
  /** null = not yet asked, true = opted in, false = rejected */
  telemetryOptIn: boolean | null;

  toggleAutoSave: () => void;
  toggleRestoreSession: () => void;
  setTheme: (theme: "light" | "dark") => void;
  setLanguage: (lang: string) => void;
  setLastFilePath: (path: string | undefined) => void;
  setSuppressSvgWarning: (suppress: boolean) => void;
  setHideDuplicateFileWarning: (hide: boolean) => void;
  setJavaImportPreference: (preference: 'model' | 'canvas' | 'both' | null) => void;
  toggleMiniMap: () => void;
  setGridType: (type: GridType) => void;
  cycleGridType: () => void;
  toggleViewportCulling: () => void;
  setSuppressCullingWarning: (v: boolean) => void;
  toggleSnapToGrid: () => void;
  toggleShowAllEdges: () => void;
  resetAllModalPreferences: () => void;
  setTelemetryOptIn: (value: boolean) => void;
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
      javaImportPreference: null,
      lastFilePath: undefined,
      showMiniMap: false,
      gridType: 'dots',
      viewportCulling: false,
      suppressCullingWarning: false,
      snapToGrid: true,
      showAllEdges: false,
      telemetryOptIn: null,

      toggleAutoSave: () => set((s) => ({ autoSave: !s.autoSave })),
      toggleRestoreSession: () => set((s) => ({ restoreSession: !s.restoreSession })),
      setTheme: (theme) => set({ theme }),
      setLanguage: (lang) => {
        i18n.changeLanguage(lang);
        set({ language: lang });
      },
      setSuppressSvgWarning: (suppress) => set({ suppressSvgWarning: suppress }),
      setHideDuplicateFileWarning: (hide) => set({ hideDuplicateFileWarning: hide }),
      setJavaImportPreference: (preference) => set({ javaImportPreference: preference }),
      setLastFilePath: (path) => set({ lastFilePath: path }),
      toggleMiniMap: () => set((s) => ({ showMiniMap: !s.showMiniMap })),
      setGridType: (type) => set({ gridType: type }),
      cycleGridType: () => set((s) => {
        const idx = GRID_CYCLE.indexOf(s.gridType);
        return { gridType: GRID_CYCLE[(idx + 1) % GRID_CYCLE.length] };
      }),
      toggleViewportCulling: () => set((s) => ({ viewportCulling: !s.viewportCulling })),
      setSuppressCullingWarning: (v) => set({ suppressCullingWarning: v }),
      toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
      toggleShowAllEdges: () => set((s) => ({ showAllEdges: !s.showAllEdges })),
      setTelemetryOptIn: (value) => set({ telemetryOptIn: value }),
      resetAllModalPreferences: () => {
        set({
          suppressSvgWarning: false,
          hideDuplicateFileWarning: false,
          javaImportPreference: null,
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
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;
        if (version === 0 && 'showGrid' in state) {
          state.gridType = state.showGrid === false ? 'none' : 'dots';
          delete state.showGrid;
        }
        return state as unknown as SettingsState;
      },
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