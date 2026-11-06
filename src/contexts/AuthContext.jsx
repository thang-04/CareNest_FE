import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  endLocalSession,
  subscribeSessionEvents,
  isLocalSessionExpired,
  hasStoredSession,
} from '@/services/authService';
import { UNAUTHORIZED_EVENT } from '@/services/http/tokenStorage';

const AuthContext = createContext(null);
const EXPIRED_MESSAGE = 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
const EXPIRY_CHECK_MS = 60_000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [sessionMessage, setSessionMessage] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  const epoch = useRef(0);
  const logoutInFlight = useRef(false);

  const retrySession = useCallback(async () => {
    const version = ++epoch.current;
    const hadSession = hasStoredSession();
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
      if (error.status === 401 && hadSession) {
        endLocalSession({ broadcast: false });
        setSessionMessage(EXPIRED_MESSAGE);
      }
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
    const onUnauthorized = () => endSession(EXPIRED_MESSAGE);
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

  // Mock không có request nào trả 401 khi token hết hạn ⇒ tự kiểm định kỳ và khi quay lại tab
  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    const check = () => {
      if (document.visibilityState === 'visible' && isLocalSessionExpired()) endSession(EXPIRED_MESSAGE);
    };
    const timer = window.setInterval(check, EXPIRY_CHECK_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [status, endSession]);

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
      // Mã quyền BE (ADR-0017); user.permissions của UI là quyền demo theo vai trò
      hasPermission: (...codes) => !!user && codes.some((code) => (user.bePermissions || []).includes(code)),
    }),
    [user, status, sessionMessage, sessionError, login, logout, refreshUser, retrySession, endSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
