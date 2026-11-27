import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getCurrentUser,
  login as loginRequest,
  logout as logoutRequest,
  endLocalSession,
  subscribeSessionEvents,
  isLocalSessionExpired,
  hasStoredSession,
  checkWebSession,
  SESSION_CHECK_ENABLED,
  confirmTakeover as confirmTakeoverRequest,
  keepSessionHere as keepSessionHereRequest,
} from '@/services/authService';
import { UNAUTHORIZED_EVENT } from '@/services/http/tokenStorage';
import { lastRefreshErrorCode, SESSION_REPLACED } from '@/services/http/authTransport';
import { hasUnsavedChanges } from '@/hooks/useLeaveGuard';

const AuthContext = createContext(null);
const EXPIRED_MESSAGE = 'Phiên đã hết hạn, hãy đăng nhập lại';
export const REPLACED_MESSAGE = 'Tài khoản vừa đăng nhập ở trình duyệt khác, phiên này đã kết thúc';
const EXPIRY_CHECK_MS = 60_000;
// AUTH-28: hỏi phiên định kỳ để tab bị đăng nhập nơi khác thay thế hiện cảnh báo ngay cả khi đang ngồi im
const SESSION_POLL_MS = 15_000;

// Lý do phiên kết thúc: BE trả 1016 khi bị đăng nhập Web mới hơn thay thế (AUTH-28), còn lại coi là hết hạn
export const sessionEndedMessage = (errorCode) => (errorCode === SESSION_REPLACED ? REPLACED_MESSAGE : EXPIRED_MESSAGE);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // 'reauth': phiên đã kết thúc nhưng màn còn thay đổi chưa lưu ⇒ giữ màn, hỏi đăng nhập lại tại chỗ
  const [status, setStatus] = useState('loading');
  const [sessionMessage, setSessionMessage] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  // AUTH-28: trình duyệt khác vừa đăng nhập cùng tài khoản và đang chờ phiên này quyết định
  const [pendingTakeover, setPendingTakeover] = useState(null);
  const epoch = useRef(0);
  const logoutInFlight = useRef(false);
  const latest = useRef({ status, user });
  latest.current = { status, user };

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
        const message = sessionEndedMessage(lastRefreshErrorCode());
        endLocalSession({ broadcast: false });
        setSessionMessage(message);
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

  const signIn = useCallback(async (request) => {
    const version = ++epoch.current;
    const current = await request();
    if (version !== epoch.current) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
    setUser(current);
    setStatus('authenticated');
    setSessionError(null);
    setSessionMessage(null);
    return current;
  }, []);

  const login = useCallback((credentials) => signIn(() => loginRequest(credentials)), [signIn]);
  // AUTH-28: "Dùng ở đây" sau khi đăng nhập báo tài khoản đang dùng ở trình duyệt khác (409 1017)
  const confirmTakeover = useCallback((options) => signIn(() => confirmTakeoverRequest(options)), [signIn]);

  // Đăng nhập lại tại chỗ: khác tài khoản thì không giữ màn của người trước (tải lại về trang chủ)
  const keepScreenFor = useCallback(
    (request) => async (input) => {
      const previousId = latest.current.user?.id;
      const current = await request(input);
      if (previousId != null && String(current.id) !== String(previousId)) window.location.assign('/');
      return current;
    },
    [],
  );
  const reauthenticate = useMemo(() => keepScreenFor(login), [keepScreenFor, login]);
  const reauthConfirmTakeover = useMemo(() => keepScreenFor(confirmTakeover), [keepScreenFor, confirmTakeover]);

  const keepSessionHere = useCallback(async (takeoverId) => {
    await keepSessionHereRequest(takeoverId);
    setPendingTakeover(null);
  }, []);

  // Phiên kết thúc (401): màn còn thay đổi chưa lưu ⇒ 'reauth' giữ nguyên dữ liệu đang nhập; không thì về đăng nhập
  const sessionEnded = useCallback(
    (message) => {
      const { status: current } = latest.current;
      if (current === 'reauth') return;
      if (current === 'authenticated' && hasUnsavedChanges()) {
        epoch.current += 1;
        endLocalSession({ broadcast: false });
        setSessionError(null);
        setSessionMessage(message);
        setStatus('reauth');
        return;
      }
      endSession(message);
    },
    [endSession],
  );

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
    setSessionMessage(error ? 'Đã thoát trên tab này, chưa kết thúc được phiên trên máy chủ' : message);
  }, []);

  const refreshUser = useCallback(async () => {
    const version = epoch.current;
    const current = await getCurrentUser();
    if (version === epoch.current) setUser(current);
    return current;
  }, []);

  useEffect(() => {
    // Tài khoản bị khóa (403/1015): BE kèm câu riêng ⇒ kết thúc phiên ngay, đăng nhập lại cũng vẫn bị khóa nên không vào 'reauth'
    const onUnauthorized = (event) => {
      const blockedMessage = event?.detail?.message;
      if (blockedMessage) endSession(blockedMessage);
      else sessionEnded(sessionEndedMessage(lastRefreshErrorCode()));
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    const unsubscribe = subscribeSessionEvents((type) => {
      if (type === 'login' && logoutInFlight.current) return;
      if (type === 'logout') endSession('Phiên đăng nhập đã kết thúc ở tab khác.', false);
      else if (latest.current.status === 'reauth') {
        // Tab khác vừa đăng nhập lại: nhận phiên mới mà không gỡ màn đang giữ dữ liệu chưa lưu
        const previousId = latest.current.user?.id;
        const version = ++epoch.current;
        getCurrentUser()
          .then((current) => {
            if (version !== epoch.current) return;
            if (String(current.id) !== String(previousId)) {
              window.location.assign('/');
              return;
            }
            setUser(current);
            setStatus('authenticated');
            setSessionMessage(null);
          })
          .catch(() => {});
      } else {
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
  }, [endSession, retrySession, sessionEnded]);

  // Mock không có request nào trả 401 khi token hết hạn ⇒ tự kiểm định kỳ và khi quay lại tab
  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    const check = () => {
      if (document.visibilityState === 'visible' && isLocalSessionExpired()) sessionEnded(EXPIRED_MESSAGE);
    };
    const timer = window.setInterval(check, EXPIRY_CHECK_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [status, sessionEnded]);

  // 401 (kể cả 1016) đã đi qua luồng hết phiên chung của beClient; lỗi mạng bỏ qua, lần sau hỏi lại
  useEffect(() => {
    setPendingTakeover(null);
    if (!SESSION_CHECK_ENABLED || status !== 'authenticated') return undefined;
    let inFlight = false;
    const poll = () => {
      if (inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      checkWebSession()
        .then((session) => setPendingTakeover(session?.pendingTakeover ?? null))
        .catch(() => {})
        .finally(() => {
          inFlight = false;
        });
    };
    const timer = window.setInterval(poll, SESSION_POLL_MS);
    document.addEventListener('visibilitychange', poll);
    window.addEventListener('focus', poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
      window.removeEventListener('focus', poll);
    };
  }, [status]);

  const value = useMemo(
    () => ({
      user,
      status,
      sessionMessage,
      sessionError,
      login,
      confirmTakeover,
      reauthenticate,
      reauthConfirmTakeover,
      pendingTakeover,
      keepSessionHere,
      logout,
      refreshUser,
      retrySession,
      endSession,
      isAuthenticated: status === 'authenticated',
      hasRole: (...roles) => !!user && roles.some((role) => (user.roles || [user.role]).includes(role)),
      // Mã quyền BE (ADR-0017); user.permissions của UI là quyền demo theo vai trò
      hasPermission: (...codes) => !!user && codes.some((code) => (user.bePermissions || []).includes(code)),
    }),
    [
      user,
      status,
      sessionMessage,
      sessionError,
      login,
      confirmTakeover,
      reauthenticate,
      reauthConfirmTakeover,
      pendingTakeover,
      keepSessionHere,
      logout,
      refreshUser,
      retrySession,
      endSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
