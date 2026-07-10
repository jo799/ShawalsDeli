import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, ClipboardList, ChefHat, Table2,
  UtensilsCrossed, Package, ShoppingBag, Users, Star,
  BarChart3, Receipt, UserSquare2, Calendar, Settings, LogOut, ChevronDown, Sun, Moon, X, Repeat
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
  { label: 'Credit Accounts', icon: CreditCard, to: '/credits' },
  { section: 'FINANCE' },
  { label: 'Reports', icon: BarChart3, to: '/reports' },
  { label: 'Expenses', icon: Receipt, to: '/expenses' },
  { section: 'STAFF' },
  { label: 'Staff', icon: UserSquare2, to: '/staff' },
  { label: 'Scheduling', icon: Calendar, to: '/scheduling' },
  { section: 'SETTINGS' },
  { label: 'Settings', icon: Settings, to: '/settings' },
];

function ShawalsLogo() {
  return (
    <svg viewBox="0 0 120 60" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Serving tray hand */}
      <g transform="translate(4,4)">
        {/* Hand / arm */}
        <path d="M18 44 L22 52 L28 50 L26 38 Z" fill="#F59E0B"/>
        {/* Tray base */}
        <rect x="10" y="36" width="32" height="3" rx="1.5" fill="#F59E0B"/>
        {/* Tray left curve */}
        <path d="M10 37 Q8 37 8 39" stroke="#F59E0B" strokeWidth="1.5" fill="none"/>
        {/* Tray right curve */}
        <path d="M42 37 Q44 37 44 39" stroke="#F59E0B" strokeWidth="1.5" fill="none"/>
        {/* Cloche dome */}
        <path d="M12 36 Q13 18 26 16 Q39 18 40 36 Z" fill="#F59E0B"/>
        {/* Cloche knob */}
        <circle cx="26" cy="16" r="2" fill="#F59E0B"/>
        {/* Steam wisps */}
        <path d="M20 12 Q18 8 20 4" stroke="#F59E0B" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <path d="M26 10 Q24 5 26 1" stroke="#F59E0B" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        {/* Highlight on dome */}
        <path d="M15 30 Q16 22 22 20" stroke="rgba(0,0,0,0.15)" strokeWidth="2" fill="none" strokeLinecap="round"/>
      </g>
      {/* Text: Shawal's */}
      <text x="52" y="28" fontFamily="Georgia, serif" fontStyle="italic" fontSize="13" fontWeight="700" fill="#F59E0B" letterSpacing="0.5">Shawal's</text>
      {/* Text: DELI */}
      <text x="56" y="42" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="900" fill="#F59E0B" letterSpacing="2">DELI</text>
      {/* Text: Swahili Dishes */}
      <text x="51" y="52" fontFamily="Arial, sans-serif" fontSize="6.5" fill="#D4A017" letterSpacing="0.5">Swahili Dishes</text>
    </svg>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside className="w-[185px] shrink-0 bg-surface-nav h-screen flex flex-col border-r border-border overflow-y-auto">
      {/* Logo */}
      <div className="px-3 py-3 border-b border-border">
        <div className="w-full h-[58px]">
          <ShawalsLogo />
        </div>
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