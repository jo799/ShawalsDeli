import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileHeader from './MobileHeader';
import OfflineIndicator from './OfflineIndicator';
import { useAutoLogout } from '@/hooks/useAutoLogout';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { setConfirmBeforeDelete } from '@/lib/confirmPreference';
import api from '@/lib/api';

export default function AppLayout() {
  const [autoLogoutDuration, setAutoLogoutDuration] = useState('Never');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { isTabletOrLarger } = useBreakpoint();

  useEffect(() => {
    api.get('/settings').then(r => {
      if (r.data.data.auto_logout) setAutoLogoutDuration(r.data.data.auto_logout);
      if (r.data.data.confirm_before_delete !== undefined) setConfirmBeforeDelete(r.data.data.confirm_before_delete === 'true');
    }).catch(() => {});
  }, []);

  useAutoLogout(autoLogoutDuration);

  // Resizing (or rotating a tablet) past the point where the sidebar
  // becomes permanent should close any open mobile drawer — otherwise it's
  // possible to end up with both the permanent sidebar AND a leftover open
  // drawer state fighting for the same space if the screen shrinks back
  // down later.
  useEffect(() => {
    if (isTabletOrLarger) setMobileNavOpen(false);
  }, [isTabletOrLarger]);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-300">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileHeader onMenuClick={() => setMobileNavOpen(true)} />
        <OfflineIndicator />
        <main className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
}