// What each role can actually reach in the UI. This mirrors the real
// authorize() rules already enforced on the backend for each area — the
// backend remains the actual security boundary regardless of what this
// file says, but showing a waiter a "Staff" or "Reports" link they'd just
// get a 403 from is confusing at best and an unnecessary hint about the
// system's shape at worst. Keeping this as ONE shared table (rather than
// the Sidebar and the "Manage Roles" panel each hardcoding their own)
// means updating a role's access can't accidentally update in one place
// and not the other.
export type Role = 'administrator' | 'manager' | 'head_chef' | 'cashier' | 'waiter' | 'kitchen_staff' | 'cleaner';

export const NAV_KEYS = [
  'dashboard', 'pos', 'orders', 'kitchen', 'tables',
  'menu', 'inventory', 'purchases',
  'customers', 'loyalty',
  'reports', 'expenses',
  'staff', 'scheduling',
  'settings',
] as const;
export type NavKey = typeof NAV_KEYS[number];

const ALL_ACCESS: Record<NavKey, boolean> = Object.fromEntries(NAV_KEYS.map(k => [k, true])) as Record<NavKey, boolean>;

// Administrator and manager get the full system — everything below this is
// about what the OTHER five roles can see.
export const ROLE_PERMISSIONS: Record<Role, Record<NavKey, boolean>> = {
  administrator: { ...ALL_ACCESS },
  manager: { ...ALL_ACCESS },
  head_chef: {
    dashboard: true, pos: false, orders: true, kitchen: true, tables: false,
    menu: true, inventory: true, purchases: true,
    customers: false, loyalty: false,
    reports: false, expenses: false,
    staff: false, scheduling: false,
    settings: false,
  },
  cashier: {
    dashboard: true, pos: true, orders: true, kitchen: false, tables: true,
    menu: false, inventory: false, purchases: false,
    customers: true, loyalty: true,
    reports: false, expenses: false,
    staff: false, scheduling: false,
    settings: false,
  },
  waiter: {
    dashboard: true, pos: true, orders: true, kitchen: false, tables: true,
    menu: false, inventory: false, purchases: false,
    customers: true, loyalty: true,
    reports: false, expenses: false,
    staff: false, scheduling: false,
    settings: false,
  },
  kitchen_staff: {
    dashboard: true, pos: false, orders: true, kitchen: true, tables: false,
    menu: false, inventory: false, purchases: false,
    customers: false, loyalty: false,
    reports: false, expenses: false,
    staff: false, scheduling: false,
    settings: false,
  },
  cleaner: {
    dashboard: true, pos: false, orders: false, kitchen: false, tables: false,
    menu: false, inventory: false, purchases: false,
    customers: false, loyalty: false,
    reports: false, expenses: false,
    staff: false, scheduling: false,
    settings: false,
  },
};

export function canAccess(role: string | undefined, key: NavKey): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) return key === 'dashboard'; // unknown role: safest default is just the dashboard
  return ROLE_PERMISSIONS[role as Role][key];
}