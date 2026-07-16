import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, ClipboardList, ChefHat, Table2,
  UtensilsCrossed, Package, ShoppingBag, Users, Star,
  BarChart3, Receipt, UserSquare2, Calendar, Settings, LogOut, ChevronDown, Sun, Moon, X, Repeat, HelpCircle
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getInitials } from '@/lib/utils';
// Relative import rather than the @shared/* alias — this file lives at a
// fixed location (frontend/src/components/layout/Sidebar.tsx), four levels
// below the project root where shared/permissions.ts lives, so this
// resolves correctly in every tool with zero path-alias configuration
// required. See authStore.ts for the same reasoning.
import { canAccessRoute } from '../../../../shared/permissions';

const NAV: Array<{ label: string; icon: typeof LayoutDashboard; to: string } | { section: string; to?: undefined }> = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'POS', icon: ShoppingCart, to: '/pos' },
  { label: 'Orders', icon: ClipboardList, to: '/orders' },
  { label: 'Kitchen Display', icon: ChefHat, to: '/kitchen' },
  { label: 'Tables', icon: Table2, to: '/tables' },
  { section: 'MENU & INVENTORY' },
  { label: 'Menu', icon: UtensilsCrossed, to: '/menu' },
  { label: 'Inventory', icon: Package, to: '/inventory' },
  { label: 'Purchases', icon: ShoppingBag, to: '/purchases' },
  { section: 'CUSTOMERS' },
  { label: 'Customers', icon: Users, to: '/customers' },
  { label: 'Loyalty Points', icon: Star, to: '/loyalty' },
  { section: 'FINANCE' },
  { label: 'Reports', icon: BarChart3, to: '/reports' },
  { label: 'Expenses', icon: Receipt, to: '/expenses' },
  { section: 'STAFF' },
  { label: 'Staff', icon: UserSquare2, to: '/staff' },
  { label: 'Scheduling', icon: Calendar, to: '/scheduling' },
  { section: 'SETTINGS' },
  { label: 'Settings', icon: Settings, to: '/settings' },
  { section: 'SUPPORT' },
  { label: 'Help', icon: HelpCircle, to: '/help' },
];

interface SidebarProps {
  // Only meaningful below the tablet breakpoint — on tablet/desktop the
  // sidebar is always visible via CSS regardless of these props. Kept
  // optional so Sidebar still renders sensibly if ever used somewhere
  // without a controlling parent.
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };
  const { theme, toggleTheme } = useThemeStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Deliberately does NOT call logout() — the whole point is not forcing
  // someone to end their own session just to let a different person sign
  // in on a shared terminal. The current token stays in localStorage,
  // unused, until a new login actually succeeds and overwrites it (see
  // authStore.login) — if whoever clicked this changes their mind and
  // navigates back without completing a new login, the original session is
  // still sitting there, completely unaffected.
  const switchUser = () => { setShowUserMenu(false); navigate('/login'); };

  // Filters the static NAV list down to what this specific role can
  // actually reach, then drops any section header left with nothing
  // visible under it (e.g. a waiter loses the whole "FINANCE" section
  // heading along with Reports and Expenses, rather than seeing an empty
  // label with nothing beneath it).
  const visibleNav = NAV.filter(item => !item.to || canAccessRoute(user?.role, item.to))
    .filter((item, i, arr) => {
      if (!('section' in item)) return true;
      const next = arr[i + 1];
      return !!next && !('section' in next);
    });

  return (
    <>
      {/* Backdrop — mobile only, closes the drawer on tap-outside. Doesn't
          exist in the DOM at all above the tablet breakpoint (rather than
          existing-but-hidden), so it can never accidentally intercept a
          click on a desktop layout. */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onMobileClose} />
      )}

      <aside
        className={`w-[185px] shrink-0 bg-surface-nav h-screen flex flex-col border-r border-border overflow-y-auto
          fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out
          md:static md:z-auto md:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Logo — the real brand asset (frontend/public/logo.png), not a
            hand-drawn approximation. object-contain keeps its true proportions
            rather than stretching it to fill the box. */}
        <div className="px-3 py-3 border-b border-border flex items-center justify-between">
          <img src="/logo.png" alt="Shawal's Deli" className="h-[58px] object-contain" />
          {/* Close button only ever shows on mobile — md:hidden matches the
              same breakpoint the drawer transform itself uses. */}
          <button onClick={onMobileClose} className="md:hidden btn-ghost p-1.5 shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-2">
          {visibleNav.map((item, i) => {
            if ('section' in item) {
              return <p key={i} className="nav-section">{item.section}</p>;
            }
            const Icon = item.icon!;
            return (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.to === '/'}
                onClick={onMobileClose}
                className={({ isActive }) => `sidebar-link mb-0.5 ${isActive ? 'active' : ''}`}
              >
                <Icon size={15} />
                <span className="text-[13px]">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User */}
        <div className="p-3 border-t border-border">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-between gap-2 px-2 py-2 mb-1 text-xs text-text-secondary hover:bg-surface-50 hover:text-text-primary rounded-lg transition-colors"
          >
            <span className="flex items-center gap-2">
              {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
            <span className={`w-8 h-4 rounded-full relative transition-colors ${theme === 'light' ? 'bg-brand' : 'bg-surface-100'}`}>
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${theme === 'light' ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </span>
          </button>
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(p => !p)}
              className="w-full flex items-center gap-2 hover:bg-surface-50 rounded-lg p-2 transition-colors group"
            >
              <div className="w-8 h-8 bg-brand rounded-full flex items-center justify-center text-black text-xs font-bold shrink-0">
                {user ? getInitials(user.full_name) : 'JK'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">{user?.full_name || 'Joseph Kimunya'}</p>
                <p className="text-[10px] text-text-muted capitalize">{user?.role?.replace('_',' ') || 'Administrator'}</p>
              </div>
              <ChevronDown size={12} className={`text-text-muted group-hover:text-brand transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-card border border-border rounded-xl shadow-modal py-1 z-50">
                  <button onClick={switchUser} className="w-full text-left px-3 py-2 text-xs hover:bg-surface-50 flex items-center gap-2">
                    <Repeat size={12} /> Switch User
                  </button>
                </div>
              </>
            )}
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-2 mt-1 px-2 py-1.5 text-xs text-text-muted hover:text-status-error transition-colors rounded">
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}