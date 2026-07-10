import { create } from 'zustand';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  avatar_url?: string;
}

// 'resource.action' strings, checked against the same role boundaries the
// backend already enforces (see backend/src/routes/index.ts) — this exists
// so the UI can hide a button someone can't actually use, rather than
// showing it and letting them discover that the hard way via a 403.
// administrator implicitly passes every check; everyone else needs an
// explicit entry below.
const PERMISSIONS: Record<string, string[]> = {
  'expenses.manage': ['administrator', 'manager'],
};

function checkPermission(role: string | undefined, permission: string): boolean {
  if (!role) return false;
  if (role === 'administrator') return true;
  return PERMISSIONS[permission]?.includes(role) ?? false;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: (() => { try { const u = localStorage.getItem('user'); return u ? JSON.parse(u) : null; } catch { return null; } })(),
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  login: (user, token) => {
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