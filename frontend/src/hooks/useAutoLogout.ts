import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

const DURATION_MS: Record<string, number | null> = {
  '15 Minutes': 15 * 60 * 1000,
  '30 Minutes': 30 * 60 * 1000,
  '1 Hour': 60 * 60 * 1000,
  'Never': null,
};

// The Settings page had an "Auto Logout" dropdown that saved a value with
// nowhere real to apply it — choosing "15 Minutes" and walking away changed
// nothing at all. This hook is that missing enforcement: it watches for
// real user activity (mouse, keyboard, touch, scroll) and logs out once the
// configured duration passes with none of it, on whatever page happens to
// be open at the time. Mounted once, high up in the authenticated app
// shell, so it runs regardless of which page is active.
export function useAutoLogout(durationLabel: string) {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuthStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ms = DURATION_MS[durationLabel];
    if (!isAuthenticated || !ms) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        logout();
        toast('You were logged out after a period of inactivity.', { icon: '🔒' });
        navigate('/login');
      }, ms);
    };

    const events: Array<keyof WindowEventMap> = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [durationLabel, isAuthenticated, logout, navigate]);
}