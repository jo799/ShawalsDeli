import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import type { Permission } from '@shared/permissions';

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setSession, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    api.get('/auth/profile')
      .then(({ data }) => {
        const profile = data.data;
        setSession(profile, profile.permissions as Permission[]);
      })
      .catch(() => {
        logout();
      });
  }, [isAuthenticated, setSession, logout]);

  return <>{children}</>;
}
