import { create } from 'zustand';
// Relative import rather than the @shared/* alias — this file lives at a
// fixed, known location (frontend/src/store/authStore.ts), three levels
// below the project root where shared/permissions.ts lives, so a relative
// path resolves correctly in every tool (tsc, Vite, any editor's language
// service) with zero path-alias configuration required anywhere. The alias
// remains available in tsconfig.json/vite.config.ts for other files that
// want it; this file just doesn't depend on it.
import { hasPermission as checkPermission, type Permission } from '../../../shared/permissions';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  // Alias for `login` — identical behavior (persist to localStorage, update
  // the store). Kept as a separate method because AuthBootstrap.tsx calls
  // it under this name, likely to distinguish "restoring a session on app
  // load" from "a fresh interactive login" at the call site, even though
  // both do the same thing here.
  setSession: (user: User, token: string) => void;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: (() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  })(),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),

  login: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  setSession: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  hasPermission: (permission) => checkPermission(get().user?.role, permission),
}));