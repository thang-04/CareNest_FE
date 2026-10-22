import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  endLocalSession,
  subscribeSessionEvents,
} from '@/services/authService';
import { UNAUTHORIZED_EVENT } from '@/services/http/tokenStorage';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sessionMessage, setSessionMessage] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  const epoch = useRef(0);
  const logoutInFlight = useRef(false);

  const retrySession = useCallback(async () => {
    const version = ++epoch.current;
    setStatus('loading');
    setSessionError(null);
    try {
      const current = await getCurrentUser();
      if (version !== epoch.current) return;
      setUser(current);
      setStatus('authenticated');
    } catch (error) {
      if (version !== epoch.current) return;
      setUser(null);
      setStatus(error.status === 401 ? 'anonymous' : 'unavailable');
      setSessionError(error.status === 401 ? null : error);
    }
  }, []);

  useEffect(() => {
    retrySession();
    return () => {
      epoch.current += 1;
    };
  }, [retrySession]);

  const endSession = useCallback((message = null, broadcast = false) => {
    epoch.current += 1;
    endLocalSession({ broadcast });
    setUser(null);
    setStatus('anonymous');
    setSessionError(null);
    setSessionMessage(message);
  }, []);

  const login = useCallback(async (credentials) => {
    const version = ++epoch.current;
    const current = await loginRequest(credentials);
    if (version !== epoch.current) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
    setUser(current);
    setStatus('authenticated');
    setSessionError(null);
    setSessionMessage(null);
    return current;
  }, []);

  const logout = useCallback(async (message = null) => {
    const version = ++epoch.current;
    setStatus('loading');
    logoutInFlight.current = true;
    const error = await logoutRequest();
    logoutInFlight.current = false;
    if (version !== epoch.current) return;
    setUser(null);
    setStatus('anonymous');
    setSessionError(null);
    setSessionMessage(
      error ? 'Đã thoát trên tab này nhưng chưa kết thúc được phiên trên máy chủ. Vui lòng thử lại khi có kết nối.' : message,
    );
  }, []);

  const refreshUser = useCallback(async () => {
    const version = epoch.current;
    const current = await getCurrentUser();
    if (version === epoch.current) setUser(current);
    return current;
  }, []);

  useEffect(() => {
    const onUnauthorized = () => endSession('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    const unsubscribe = subscribeSessionEvents((type) => {
      if (type === 'login' && logoutInFlight.current) return;
      if (type === 'logout') endSession('Phiên đăng nhập đã kết thúc ở tab khác.', false);
      else {
        epoch.current += 1;
        endLocalSession({ broadcast: false });
        setUser(null);
        retrySession();
      }
    });
    return () => {
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
      unsubscribe();
    };
  }, [endSession, retrySession]);

  const value = useMemo(
    () => ({
      user,
      status,
      sessionMessage,
      sessionError,
      login,
      logout,
      refreshUser,
      retrySession,
      endSession,
      isAuthenticated: status === 'authenticated',
      hasRole: (...roles) => !!user && roles.some((role) => (user.roles || [user.role]).includes(role)),
      hasPermission: (...codes) => !!user && codes.some((code) => (user.permissions || []).includes(code)),
    }),
    [user, status, sessionMessage, sessionError, login, logout, refreshUser, retrySession, endSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
