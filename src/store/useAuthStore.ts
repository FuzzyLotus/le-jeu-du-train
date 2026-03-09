import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthService } from '../services/AuthService';
import type { User } from '../types/models';

interface AuthState {
  currentUser: User | null;
  isLoading: boolean;
  setCurrentUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentUser: null,
      isLoading: true,
      setCurrentUser: (user) => set({ currentUser: user, isLoading: false }),
      setLoading: (loading) => set({ isLoading: loading }),
      logout: () => {
        AuthService.clearToken();
        set({ currentUser: null, isLoading: false });
      },
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        if (state) state.setLoading(false);
      },
    }
  )
);
