import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentUser, login as loginRequest, logout as logoutRequest } from '@/services/authService';
import { UNAUTHORIZED_EVENT } from '@/services/http/tokenStorage';

const AuthContext = createContext(null);

/**
 * status: 'loading' (checking stored token) | 'authenticated' | 'anonymous'
 * Use: const { user, status, login, logout, hasRole } = useAuth();
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sessionMessage, setSessionMessage] = useState(null);

  // Restore the session from the stored token.
  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        setUser(u);
        setStatus('authenticated');
      })
      .catch((err) => {
        if (err.status === 401 && err.message !== 'Chưa đăng nhập') setSessionMessage(err.message);
        setUser(null);
        setStatus('anonymous');
      });
  }, []);

  const login = useCallback(async (credentials) => {
    const u = await loginRequest(credentials);
    setSessionMessage(null);
    setUser(u);
    setStatus('authenticated');
    return u;
  }, []);

  const logout = useCallback(async (message = null) => {
    await logoutRequest();
    setSessionMessage(message);
    setUser(null);
    setStatus('anonymous');
  }, []);

  // Reload the signed-in user after a profile change so the header shows fresh data.
  const refreshUser = useCallback(async () => {
    const u = await getCurrentUser();
    setUser(u);
    return u;
  }, []);

  // Any API call answering 401 ends the session.
  useEffect(() => {
    const onUnauthorized = () => logout('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      sessionMessage,
      login,
      logout,
      refreshUser,
      hasRole: (...roles) => !!user && roles.includes(user.role),
    }),
    [user, status, sessionMessage, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
