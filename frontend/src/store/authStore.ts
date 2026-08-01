import { create } from 'zustand';
// Relative import rather than the @shared/* alias — this file lives at a
// fixed, known location (frontend/src/store/authStore.ts), three levels
// below the project root where shared/permissions.ts lives, so a relative
// path resolves correctly in every tool (tsc, Vite, any editor's language
// service) with zero path-alias configuration required anywhere. The alias
// remains available in tsconfig.json/vite.config.ts for other files that
// want it; this file just doesn't depend on it.
import { hasPermission as checkPermission, ROLES, ROUTE_PERMISSIONS, type Permission } from '../../../shared/permissions';
import api from '@/lib/api';

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
  // A custom role's permissions live in the database, not in the compiled
  // shared/permissions.ts map — fetched once after login/session-restore
  // and cached here, since hasPermission is called synchronously all over
  // the app (including at render time in the sidebar) and can't itself
  // await a network call. customRolePermissionsLoaded distinguishes
  // "haven't checked yet" from "checked, and this role genuinely has zero
  // permissions" - hasPermission fails closed (denies) during that brief
  // loading window rather than momentarily granting access it shouldn't.
  customRolePermissions: Permission[] | null;
  customRolePermissionsLoaded: boolean;
  login: (user: User, token: string) => void;
  // Alias for `login` — identical behavior (persist to localStorage, update
  // the store). Kept as a separate method because AuthBootstrap.tsx calls
  // it under this name, likely to distinguish "restoring a session on app
  // load" from "a fresh interactive login" at the call site, even though
  // both do the same thing here.
  setSession: (user: User, token: string) => void;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  canAccessRoute: (path: string) => boolean;
}

const isBuiltInRole = (role: string) => (ROLES as readonly string[]).includes(role);

// Fire-and-forget: looks up this one role's permissions (the endpoint is
// open to any authenticated user, unlike the full custom-roles list, since
// a custom-role user needs to resolve their own access without needing
// admin/manager rights just to check themselves). Silently treats a
// missing/errored lookup as "no permissions" rather than throwing —
// consistent with hasPermission's fail-closed default during the loading
// window itself.
const loadCustomRolePermissions = async (role: string, set: (partial: Partial<AuthState>) => void) => {
  if (isBuiltInRole(role)) { set({ customRolePermissions: null, customRolePermissionsLoaded: true }); return; }
  try {
    const { data } = await api.get(`/roles/custom/${encodeURIComponent(role)}`);
    set({ customRolePermissions: data.data.permissions as Permission[], customRolePermissionsLoaded: true });
  } catch {
    set({ customRolePermissions: [], customRolePermissionsLoaded: true });
  }
};

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
  customRolePermissions: null,
  customRolePermissionsLoaded: false,

  login: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, customRolePermissionsLoaded: false });
    loadCustomRolePermissions(user.role, set);
  },

  setSession: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, customRolePermissionsLoaded: false });
    loadCustomRolePermissions(user.role, set);
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false, customRolePermissions: null, customRolePermissionsLoaded: false });
  },

  hasPermission: (permission) => {
    const { user, customRolePermissions, customRolePermissionsLoaded } = get();
    if (!user) return false;
    if (isBuiltInRole(user.role)) return checkPermission(user.role, permission);
    if (!customRolePermissionsLoaded) return false;
    return (customRolePermissions ?? []).includes(permission);
  },

  canAccessRoute: (path) => {
    const permission = ROUTE_PERMISSIONS[path];
    if (!permission) return true;
    return get().hasPermission(permission);
  },
}));