import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storageAdapter } from '../adapters/storage/storage.adapter';

export type BottomPanelTab = 'terminal' | 'problems';

interface LayoutStoreState {
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  isBottomPanelOpen: boolean;
  bottomPanelTab: BottomPanelTab;

  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleBottomPanel: () => void;
  setBottomPanelTab: (tab: BottomPanelTab) => void;
  openProblemsTab: () => void;
}

export const useLayoutStore = create<LayoutStoreState>()(
  persist(
    (set) => ({
      isLeftPanelOpen: true,
      isRightPanelOpen: true,
      isBottomPanelOpen: false,
      bottomPanelTab: 'terminal',

      toggleLeftPanel: () =>
        set((s) => ({ isLeftPanelOpen: !s.isLeftPanelOpen })),

      toggleRightPanel: () =>
        set((s) => ({ isRightPanelOpen: !s.isRightPanelOpen })),

      toggleBottomPanel: () =>
        set((s) => ({ isBottomPanelOpen: !s.isBottomPanelOpen })),

      setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),

      openProblemsTab: () =>
        set({ isBottomPanelOpen: true, bottomPanelTab: 'problems' }),
    }),
    {
      name: 'libreuml-layout',
      partialize: (state) => ({
        isLeftPanelOpen: state.isLeftPanelOpen,
        isRightPanelOpen: state.isRightPanelOpen,
        isBottomPanelOpen: state.isBottomPanelOpen,
        bottomPanelTab: state.bottomPanelTab,
      }),
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
    },
  ),
);
