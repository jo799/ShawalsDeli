import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token, login, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    api.get('/auth/profile')
      .then(({ data }) => {
        const profile = data.data;
        login(profile, token);
      })
      .catch(() => {
        logout();
      });
  }, [isAuthenticated, token, login, logout]);

  return <>{children}</>;
}
