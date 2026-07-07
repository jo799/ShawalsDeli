import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, ClipboardList, ChefHat, Table2,
  UtensilsCrossed, Package, ShoppingBag, Users, Star,
  BarChart3, Receipt, UserSquare2, Calendar, Settings, LogOut, ChevronDown, Sun, Moon
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { getInitials } from '@/lib/utils';

const NAV = [
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
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };
  const { theme, toggleTheme } = useThemeStore();

  return (
    <aside className="w-[185px] shrink-0 bg-surface-nav h-screen flex flex-col border-r border-border overflow-y-auto">
      {/* Logo — the real brand asset (frontend/public/logo.png), not a
          hand-drawn approximation. object-contain keeps its true proportions
          rather than stretching it to fill the box. */}
      <div className="px-3 py-3 border-b border-border">
        <img src="/logo.png" alt="Shawal's Deli" className="w-full h-[58px] object-contain" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2">
        {NAV.map((item, i) => {
          if ('section' in item) {
            return <p key={i} className="nav-section">{item.label}</p>;
          }
          const Icon = item.icon!;
          return (
            <NavLink
              key={item.to}
              to={item.to!}
              end={item.to === '/'}
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
        <div className="w-full flex items-center gap-2 hover:bg-surface-50 rounded-lg p-2 transition-colors group cursor-pointer">
          <div className="w-8 h-8 bg-brand rounded-full flex items-center justify-center text-black text-xs font-bold shrink-0">
            {user ? getInitials(user.full_name) : 'JK'}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">{user?.full_name || 'Joseph Kimunya'}</p>
            <p className="text-[10px] text-text-muted capitalize">{user?.role?.replace('_',' ') || 'Administrator'}</p>
          </div>
          <ChevronDown size={12} className="text-text-muted group-hover:text-brand transition-colors" />
        </div>
        <button onClick={handleLogout} className="w-full flex items-center gap-2 mt-1 px-2 py-1.5 text-xs text-text-muted hover:text-status-error transition-colors rounded">
          <LogOut size={12} />
          Sign out
        </button>
      </div>
    </aside>
  );
}