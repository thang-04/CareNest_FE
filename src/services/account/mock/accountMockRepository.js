import { readDb, writeDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { pushNotification } from '@/mocks/notificationMockRepository';
import { createPasswordToken, passwordMatches, setUserPassword } from '@/mocks/authMockRepository';
import { uid } from '@/utils/id';
import { ageGroupById } from '@/models/School';
import {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  EDITABLE_PROFILE_FIELDS,
  PASSWORD_TOKEN_PURPOSE,
} from '@/models/account/accountConstants';
import { validateEmailForm, validateOtp, validatePasswordChange, validateProfile, normalizePhone } from '@/utils/account/accountValidation';
import { canManageOwnAccount, canViewNotification } from '@/utils/account/accountPermissions';

/*
 * Fake backend for the account module. Rules the Spring Boot service must repeat:
 *   - GBR-AUTH-01: a reset needs a verified OTP of the same recovery request; wrong / expired / used codes never authorize it.
 *   - GBR-AUTH-02: new password follows the policy, confirmation must match, current password checked for a signed-in change.
 *   - OTP expires after 5 minutes, can be resent after 60 s, 5 wrong tries end that code (values are assumptions).
 *   - A user reads and edits only their own profile / notifications (SRS 4.4: own profile & password = Full for every role).
 */

const MSG_OTP_INVALID = 'Mã xác thực không đúng hoặc đã hết hạn. Vui lòng gửi lại mã mới.';
const MSG_REQUEST_GONE = 'Yêu cầu khôi phục mật khẩu không còn hiệu lực. Vui lòng bắt đầu lại.';
const MSG_NO_PERMISSION = 'Bạn không có quyền thực hiện thao tác này.';
const MSG_PROFILE_UNAVAILABLE = 'Hiện chưa tải được hồ sơ của bạn. Vui lòng thử lại sau.';

const maskEmail = (email) => {
  const [name, domain] = String(email).split('@');
  if (!domain) return '***';
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${'*'.repeat(Math.max(3, name.length - visible.length))}@${domain}`;
};

const newOtpCode = () => String(Math.floor(Math.random() * 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');

const publicRequest = (req, user) => ({
  requestId: req.id,
  channel: req.channel,
  maskedDestination: maskEmail(user?.email || req.destination),
  expiresAt: new Date(req.expiresAt).toISOString(),
  resendAvailableAt: new Date(req.resendAvailableAt).toISOString(),
});

const activeRequest = (db, requestId) => {
  const req = (db.otpRequests || []).find((r) => r.id === requestId);
  if (!req || req.cancelled || req.used) throw new ApiError(410, MSG_REQUEST_GONE);
  return req;
};

const userOf = (db, id) => db.users.find((u) => u.id === id);

const publicProfile = (db, u) => {
  const { password: _password, ...rest } = u; // carenest:allow-secret – tên field, không phải giá trị bí mật
  const campus = (db.campuses || []).find((c) => c.id === u.campusId);
  const cls = (db.classes || []).find((c) => c.id === u.classId);
  return clone({
    ...rest,
    scope: {
      campusName: campus?.name || null,
      ageGroupName: ageGroupById(u.ageGroupId)?.name || null,
      className: cls?.name || null,
    },
    passwordChangedAt: db.authCredentials?.[u.id]?.changedAt || null,
  });
};

const requireAccountUser = (user) => {
  if (!canManageOwnAccount(user)) throw new ApiError(403, MSG_NO_PERMISSION);
};

const notifyPasswordChanged = (db, userId) =>
  pushNotification(db, {
    userId,
    type: 'ACCOUNT_PASSWORD_CHANGED',
    title: 'Mật khẩu đã được thay đổi',
    message: 'Mật khẩu tài khoản của bạn vừa được thay đổi. Nếu không phải bạn thực hiện, hãy liên hệ văn phòng nhà trường ngay.',
    link: '/account/profile',
  });

export const accountMockRepository = {
  /* ---------- Forgot password (SRS 1.6) ---------- */
  async requestPasswordReset({ email }) {
    await delay(600);
    const errors = validateEmailForm({ email });
    if (Object.keys(errors).length) throw new ApiError(422, errors.email, errors);
    const normalized = String(email).trim().toLowerCase();
    return writeDb((db) => {
      const user = db.users.find((u) => u.email.toLowerCase() === normalized);
      if (!user || user.status === 'LOCKED' || user.status === 'INACTIVE') {
        throw new ApiError(404, 'Không xác minh được tài khoản với email này. Kiểm tra lại email hoặc liên hệ văn phòng nhà trường.');
      }
      db.otpRequests ||= [];
      // Only the newest request of an account stays usable.
      db.otpRequests
        .filter((r) => r.userId === user.id && !r.used)
        .forEach((r) => {
          r.cancelled = true;
        });
      const now = Date.now();
      const req = {
        id: uid('otp'),
        userId: user.id,
        channel: 'EMAIL',
        destination: user.email,
        code: newOtpCode(),
        attempts: 0,
        expiresAt: now + OTP_TTL_MS,
        resendAvailableAt: now + OTP_RESEND_COOLDOWN_MS,
        createdAt: new Date(now).toISOString(),
        used: false,
        cancelled: false,
      };
      db.otpRequests.push(req);
      return publicRequest(req, user);
    });
  },

  async getOtpRequest(requestId) {
    await delay(80);
    const db = readDb();
    const req = activeRequest(db, requestId);
    return publicRequest(req, userOf(db, req.userId));
  },

  async resendOtp(requestId) {
    await delay(500);
    return writeDb((db) => {
      const req = activeRequest(db, requestId);
      const now = Date.now();
      if (req.resendAvailableAt > now) {
        const wait = Math.ceil((req.resendAvailableAt - now) / 1000);
        throw new ApiError(429, `Vui lòng chờ ${wait} giây rồi gửi lại mã.`);
      }
      req.code = newOtpCode();
      req.attempts = 0;
      req.expiresAt = now + OTP_TTL_MS;
      req.resendAvailableAt = now + OTP_RESEND_COOLDOWN_MS;
      return publicRequest(req, userOf(db, req.userId));
    });
  },

  /* ---------- Verify OTP (SRS 1.7) ---------- */
  async verifyOtp({ requestId, otp }) {
    await delay(500);
    const errors = validateOtp({ otp });
    if (Object.keys(errors).length) throw new ApiError(422, errors.otp, errors);
    const result = writeDb((db) => {
      const req = activeRequest(db, requestId);
      if (req.attempts >= OTP_MAX_ATTEMPTS) return { error: 'TOO_MANY' };
      if (req.expiresAt < Date.now() || req.code !== String(otp).trim()) {
        req.attempts += 1;
        return { error: req.attempts >= OTP_MAX_ATTEMPTS ? 'TOO_MANY' : 'INVALID' };
      }
      req.used = true; // a code authorizes one reset only
      return { resetToken: createPasswordToken(db, req.userId, PASSWORD_TOKEN_PURPOSE.RESET) };
    });
    // Thrown outside writeDb so the attempt counter is kept (writeDb rolls back on throw).
    if (result.error === 'TOO_MANY') {
      const msg = 'Bạn đã nhập sai quá số lần cho phép. Vui lòng gửi lại mã mới.';
      throw new ApiError(429, msg, { otp: msg });
    }
    if (result.error) throw new ApiError(400, MSG_OTP_INVALID, { otp: MSG_OTP_INVALID });
    return result;
  },

  /* ---------- Set a password without a session: reset (SRS 1.6) or first login (SRS 1.1 step 7) ---------- */
  async setPasswordWithToken({ token, newPassword, confirmPassword }) {
    await delay(500);
    const errors = validatePasswordChange({ newPassword, confirmPassword });
    if (Object.keys(errors).length) throw new ApiError(422, 'Mật khẩu mới chưa hợp lệ', errors);
    return writeDb((db) => {
      const entry = (db.passwordTokens || []).find((t) => t.token === token);
      if (!entry || entry.used || entry.expiresAt < Date.now()) {
        throw new ApiError(410, 'Phiên đặt mật khẩu đã hết hạn. Vui lòng thực hiện lại từ đầu.');
      }
      const user = userOf(db, entry.userId);
      if (!user) throw new ApiError(410, 'Tài khoản không còn tồn tại.');
      entry.used = true;
      setUserPassword(db, user.id, newPassword);
      notifyPasswordChanged(db, user.id);
      return { email: user.email, purpose: entry.purpose };
    });
  },

  /* ---------- Change password while signed in (SRS 1.2) ---------- */
  async changePassword({ currentPassword, newPassword, confirmPassword }, user) {
    await delay(500);
    requireAccountUser(user);
    const errors = validatePasswordChange({ currentPassword, newPassword, confirmPassword }, { requireCurrent: true });
    if (Object.keys(errors).length) throw new ApiError(422, 'Thông tin đổi mật khẩu chưa hợp lệ', errors);
    if (!passwordMatches(readDb(), user.id, currentPassword)) {
      throw new ApiError(400, 'Mật khẩu hiện tại không đúng.', { currentPassword: 'Mật khẩu hiện tại không đúng' });
    }
    writeDb((db) => {
      setUserPassword(db, user.id, newPassword);
      notifyPasswordChanged(db, user.id);
    });
  },

  /* ---------- Own profile (SRS 1.5, screen 7) ---------- */
  async getProfile(user) {
    await delay(150);
    requireAccountUser(user);
    const db = readDb();
    const found = userOf(db, user.id);
    if (!found) throw new ApiError(404, MSG_PROFILE_UNAVAILABLE);
    return publicProfile(db, found);
  },

  async updateProfile(patch, user) {
    await delay(400);
    requireAccountUser(user);
    // Only whitelisted fields; name, email, role and scope are managed by the school.
    const changes = {};
    EDITABLE_PROFILE_FIELDS.forEach((f) => {
      if (patch && f in patch) changes[f] = typeof patch[f] === 'string' ? patch[f].trim() : patch[f];
    });
    return writeDb((db) => {
      const target = userOf(db, user.id);
      if (!target) throw new ApiError(404, MSG_PROFILE_UNAVAILABLE);
      const errors = validateProfile({ ...target, ...changes });
      const phone = normalizePhone(changes.phone ?? target.phone);
      if (!errors.phone && db.users.some((u) => u.id !== user.id && normalizePhone(u.phone) === phone)) {
        errors.phone = 'Số điện thoại đã được dùng cho tài khoản khác';
      }
      if (Object.keys(errors).length) throw new ApiError(422, 'Thông tin hồ sơ chưa hợp lệ', errors);
      Object.assign(target, changes, { updatedAt: new Date().toISOString() });
      return publicProfile(db, target);
    });
  },

  /* ---------- Notification detail (SRS 1.4 steps 7–8, screen 9) ---------- */
  async getNotification(id, user) {
    await delay(120);
    const found = readDb().notifications.find((n) => n.id === id);
    if (!found) throw new ApiError(404, 'Thông báo không tồn tại hoặc đã bị xóa.');
    if (!canViewNotification(found, user)) throw new ApiError(403, MSG_NO_PERMISSION);
    if (!found.read) {
      writeDb((db) => {
        const n = db.notifications.find((x) => x.id === id);
        if (n) n.read = true;
      });
    }
    return clone({ ...found, read: true });
  },

  /** Mock only: the code that would be emailed, shown in the demo hint. */
  async demoOtp(requestId) {
    await delay(30);
    const req = (readDb().otpRequests || []).find((r) => r.id === requestId);
    return req && !req.used && !req.cancelled ? req.code : null;
  },
};
