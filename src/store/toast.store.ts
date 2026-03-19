import { create } from 'zustand';

const AUTO_DISMISS_MS = 3500;

interface Toast {
  id: string;
  message: string;
}

interface ToastStoreState {
  toasts: Toast[];
  show: (message: string) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],

  show: (message) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, AUTO_DISMISS_MS);
  },

  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
