import { create } from 'zustand';
import type { Permission } from '@shared/permissions';
import { getPermissionsForRole } from '@shared/permissions';

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
  permissions: Permission[];
  isAuthenticated: boolean;
  login: (user: User, token: string, permissions?: Permission[]) => void;
  setSession: (user: User, permissions: Permission[]) => void;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
}

function loadStoredUser(): User | null {
  try {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

function loadStoredPermissions(user: User | null): Permission[] {
  try {
    const stored = localStorage.getItem('permissions');
    if (stored) return JSON.parse(stored);
  } catch {
    // fall through
  }
  return user ? getPermissionsForRole(user.role) : [];
}

const initialUser = loadStoredUser();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialUser,
  token: localStorage.getItem('token'),
  permissions: loadStoredPermissions(initialUser),
  isAuthenticated: !!localStorage.getItem('token'),
  login: (user, token, permissions) => {
    const resolved = permissions ?? getPermissionsForRole(user.role);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('permissions', JSON.stringify(resolved));
    set({ user, token, permissions: resolved, isAuthenticated: true });
  },
  setSession: (user, permissions) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('permissions', JSON.stringify(permissions));
    set({ user, permissions });
  },
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('permissions');
    set({ user: null, token: null, permissions: [], isAuthenticated: false });
  },
  hasPermission: (permission) => {
    const { permissions, user } = get();
    if (permissions.length > 0) return permissions.includes(permission);
    return getPermissionsForRole(user?.role ?? '').includes(permission);
  },
}));