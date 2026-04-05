import { useCallback, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function useAuth() {
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login: storeLogin,
    logout: storeLogout,
    refreshToken,
    clearError,
  } = useAuthStore();

  // Refresh token on mount if we have one
  useEffect(() => {
    if (token && !user) {
      refreshToken();
    }
  }, [token, user, refreshToken]);

  const login = useCallback(
    async (email: string, password: string) => {
      await storeLogin(email, password);
    },
    [storeLogin]
  );

  const logout = useCallback(() => {
    storeLogout();
    window.location.href = '/login';
  }, [storeLogout]);

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    clearError,
  };
}
