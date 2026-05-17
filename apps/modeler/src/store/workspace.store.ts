import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storageAdapter } from '../adapters/storage/storage.adapter';

interface WorkspaceStoreState {
  openTabs: string[];
  activeTabId: string | null;
  /** Connection mode per tab, keyed by tabId. */
  connectionModes: Record<string, string>;

  openTab: (fileId: string) => void;
  closeTab: (fileId: string) => void;
  setActiveTab: (fileId: string) => void;
  closeAllTabs: () => void;
  setTabConnectionMode: (tabId: string, mode: string) => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>()(
  persist(
    (set) => ({
      openTabs: [],
      activeTabId: null,
      connectionModes: {},

      openTab: (fileId) =>
        set((state) => {
          if (state.openTabs.includes(fileId)) {
            return { activeTabId: fileId };
          }
          return {
            openTabs: [...state.openTabs, fileId],
            activeTabId: fileId,
          };
        }),

      closeTab: (fileId) =>
        set((state) => {
          const newOpenTabs = state.openTabs.filter((id) => id !== fileId);
          let newActiveTabId = state.activeTabId;

          if (state.activeTabId === fileId) {
            if (newOpenTabs.length === 0) {
              newActiveTabId = null;
            } else {
              const closedIndex = state.openTabs.indexOf(fileId);
              newActiveTabId = newOpenTabs[closedIndex > 0 ? closedIndex - 1 : 0];
            }
          }

          return {
            openTabs: newOpenTabs,
            activeTabId: newActiveTabId,
          };
        }),

      setActiveTab: (fileId) => set({ activeTabId: fileId }),

      closeAllTabs: () => set({ openTabs: [], activeTabId: null }),

      setTabConnectionMode: (tabId, mode) =>
        set((state) => ({
          connectionModes: {
            ...state.connectionModes,
            [tabId]: mode,
          },
        })),
    }),
    {
      name: 'libreuml-workspace-storage',
      version: 2,
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
      migrate: (persistedState: unknown, version: number) => {
        if (version === 1) {
          const s = persistedState as Record<string, unknown>;
          return {
            openTabs: (s.openTabs as string[]) ?? [],
            activeTabId: (s.activeTabId as string | null) ?? null,
            connectionModes: (s.connectionModes as Record<string, string>) ?? {},
          };
        }
        return persistedState as WorkspaceStoreState;
      },
    }
  )
);
