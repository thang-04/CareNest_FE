import { readDb, writeDb, clone, delay, ApiError } from './mockDatabase';
import { uid } from '@/utils/id';

/*
 * Fake auth server. Behaves like the Spring Boot endpoints:
 *   POST /auth/login  { email, password, remember } -> { accessToken, expiresAt, user }
 *   GET  /auth/me     (Bearer token)                -> user
 * Passwords exist only here (mock). Real backend stores BCrypt hashes.
 *
 * Rules (SRS 1.1, GBR-GEN-04, GBR-GEN-05, GBR-AUTH-02):
 *   - one generic message for a wrong email or password;
 *   - 5 consecutive failures lock the account for 30 minutes (423);
 *   - a deactivated account cannot sign in (403);
 *   - an account that still uses an issued password must change it first (428 + changeToken, no session).
 */
export const DEMO_PASSWORD = '123456';

const TTL_SHORT = 8 * 3600 * 1000; // 8 hours
const TTL_LONG = 30 * 24 * 3600 * 1000; // 30 days ("Ghi nhớ đăng nhập")
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 30 * 60 * 1000;
const CHANGE_TOKEN_TTL_MS = 10 * 60 * 1000;

const encode = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
const decode = (str) => JSON.parse(decodeURIComponent(escape(atob(str))));

/** JWT-like token: header.payload.signature (signature is fake in mock mode). */
const issueToken = (user, remember) => {
  const exp = Date.now() + (remember ? TTL_LONG : TTL_SHORT);
  const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: user.id, role: user.role, exp })}.mock`;
  return { token, exp };
};

const publicUser = (u) => {
  const { password: _password, ...rest } = u; // carenest:allow-secret – tên field, không phải giá trị bí mật
  return clone(rest);
};

const pad = (n) => String(n).padStart(2, '0');
const clock = (ms) => {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/* ---------- Server-side credential helpers (used inside writeDb by mock repositories) ---------- */

/** Per-user credential record, created lazily: { password?, mustChange, failedAttempts, lockedUntil }. */
export const credentialOf = (db, userId) => {
  db.authCredentials ||= {};
  db.authCredentials[userId] ||= { password: null, mustChange: false, failedAttempts: 0, lockedUntil: null };
  return db.authCredentials[userId];
};

/** Read-only check. The demo password keeps working for every demo account (mock convenience only). */
export const passwordMatches = (db, userId, password) => {
  if (!password) return false;
  const cred = db.authCredentials?.[userId];
  if (cred?.mustChange) return password === cred.password;
  return password === DEMO_PASSWORD || (!!cred?.password && password === cred.password);
};

/** Stores a new password chosen by the user and clears the issued-password flag and the lock. */
export const setUserPassword = (db, userId, password) => {
  const cred = credentialOf(db, userId);
  cred.password = password; // carenest:allow-secret – tên field, không phải giá trị bí mật
  cred.mustChange = false;
  cred.failedAttempts = 0;
  cred.lockedUntil = null;
  cred.changedAt = new Date().toISOString();
};

/**
 * For other modules (e.g. enrollment creating a parent / staff account): the account receives an issued
 * password that is accepted once at sign-in and must be changed before reaching the home page.
 */
export const issuePassword = (db, userId, password) => {
  const cred = credentialOf(db, userId);
  cred.password = password; // carenest:allow-secret – tên field, không phải giá trị bí mật
  cred.mustChange = true;
  cred.failedAttempts = 0;
  cred.lockedUntil = null;
};

/** One-time token allowing a password to be set without a session (forgot password, first login). */
export const createPasswordToken = (db, userId, purpose) => {
  db.passwordTokens ||= [];
  const token = uid('pwt');
  db.passwordTokens.push({ token, userId, purpose, expiresAt: Date.now() + CHANGE_TOKEN_TTL_MS, used: false });
  return token;
};

export const authMockRepository = {
  async login({ email, password, remember }) {
    await delay(500);
    const normalized = String(email || '')
      .trim()
      .toLowerCase();
    if (!normalized || !password) throw new ApiError(400, 'Vui lòng nhập email và mật khẩu');
    const user = readDb().users.find((u) => u.email.toLowerCase() === normalized);
    // Same message for wrong email or password (do not reveal which accounts exist).
    if (!user) throw new ApiError(401, 'Email hoặc mật khẩu không đúng');

    const cred = readDb().authCredentials?.[user.id];
    if (cred?.lockedUntil && cred.lockedUntil > Date.now()) {
      throw new ApiError(423, `Tài khoản đang tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${clock(cred.lockedUntil)}.`);
    }

    const ok = passwordMatches(readDb(), user.id, password);
    const issuedMatch = ok && !!cred?.mustChange;
    if (!ok) {
      const lockedUntil = writeDb((db) => {
        const c = credentialOf(db, user.id);
        c.failedAttempts = (c.lockedUntil && c.lockedUntil <= Date.now() ? 0 : c.failedAttempts) + 1;
        if (c.failedAttempts >= MAX_FAILED_ATTEMPTS) {
          c.lockedUntil = Date.now() + LOCK_MS;
          c.failedAttempts = 0;
          return c.lockedUntil;
        }
        return null;
      });
      if (lockedUntil) {
        throw new ApiError(423, `Tài khoản đang tạm khóa do nhập sai nhiều lần. Vui lòng thử lại sau ${clock(lockedUntil)}.`);
      }
      throw new ApiError(401, 'Email hoặc mật khẩu không đúng');
    }

    if (user.status === 'LOCKED' || user.status === 'INACTIVE') {
      throw new ApiError(403, 'Tài khoản này đã ngừng hoạt động. Vui lòng liên hệ văn phòng nhà trường.');
    }

    if (cred && (cred.failedAttempts || cred.lockedUntil)) {
      writeDb((db) => {
        const c = credentialOf(db, user.id);
        c.failedAttempts = 0;
        c.lockedUntil = null;
      });
    }

    if (issuedMatch) {
      // No session yet: the issued password only opens the "change password" step (GBR-AUTH-02).
      const changeToken = writeDb((db) => createPasswordToken(db, user.id, 'FIRST_LOGIN'));
      throw new ApiError(428, 'Bạn đang dùng mật khẩu được cấp. Vui lòng đặt mật khẩu mới để tiếp tục.', {
        passwordChangeRequired: true,
        changeToken,
      });
    }

    const { token, exp } = issueToken(user, remember);
    return { accessToken: token, expiresAt: new Date(exp).toISOString(), user: publicUser(user) };
  },

  async me(token) {
    await delay(120);
    if (!token) throw new ApiError(401, 'Phiên đăng nhập đã hết hạn');
    let payload;
    try {
      payload = decode(token.split('.')[1]);
    } catch {
      throw new ApiError(401, 'Phiên đăng nhập không hợp lệ');
    }
    if (!payload.exp || payload.exp < Date.now()) throw new ApiError(401, 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
    const user = readDb().users.find((u) => u.id === payload.sub);
    if (!user) throw new ApiError(401, 'Tài khoản không còn tồn tại');
    return publicUser(user);
  },

  async logout() {
    await delay(80);
  },

  /** Mock only: accounts shown on the login page to make testing easy. */
  async demoAccounts() {
    await delay(30);
    return readDb().users.map(publicUser);
  },
};
