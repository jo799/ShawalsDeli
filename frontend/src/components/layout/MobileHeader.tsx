import { Menu } from 'lucide-react';

interface MobileHeaderProps {
  onMenuClick: () => void;
}

// Shown only below the tablet breakpoint (md:hidden) — on tablet/desktop
// the sidebar is permanently visible so there's nothing for this bar to
// trigger. Kept as its own tiny component rather than inlined into
// AppLayout so the "mobile chrome" piece of the responsive system has one
// clear place to live if it needs to grow (a page title, a search icon,
// notifications, etc.) without that logic getting tangled into the layout
// component itself.
export default function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-nav shrink-0">
      <button onClick={onMenuClick} className="btn-ghost p-1.5 -ml-1.5" aria-label="Open menu">
        <Menu size={20} />
      </button>
      <img src="/logo.png" alt="Shawal's Deli" className="h-8 object-contain" />
    </header>
  );
}