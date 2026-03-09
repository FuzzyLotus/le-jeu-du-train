import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'achievement' | 'info';

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
  icon?: string; // Optional custom emoji/icon
  timer?: ReturnType<typeof setTimeout>;
}

interface ToastStore {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(2, 9);
    
    // Auto-remove after 4 seconds
    const timer = setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 4000);

    set((state) => ({ toasts: [...state.toasts, { ...toast, id, timer }] }));
  },
  removeToast: (id) => set((state) => {
    const toast = state.toasts.find(t => t.id === id);
    if (toast?.timer) clearTimeout(toast.timer);
    return { toasts: state.toasts.filter((t) => t.id !== id) };
  }),
}));
