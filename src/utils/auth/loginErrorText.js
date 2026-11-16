// Câu ngắn cho lỗi đăng nhập theo errorCode của BE (1001…); BE trả câu dài kèm ngoặc đơn nên không hiện nguyên văn
const BY_CODE = {
  1001: 'Sai tài khoản hoặc mật khẩu',
  1012: 'Đăng nhập web đang tạm tắt',
  1013: 'Dịch vụ đăng nhập đang gián đoạn',
  1014: 'Tài khoản chưa được cấp quyền',
  1015: 'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ Ban Giám hiệu để được hỗ trợ mở lại.',
};

/** Chữ hiện ở hộp lỗi trang đăng nhập: ưu tiên câu ngắn theo mã lỗi, không có thì dùng câu của lỗi. */
export const loginErrorText = (err) => BY_CODE[err?.errorCode] || err?.message || 'Không đăng nhập được, vui lòng thử lại';

export const LOGIN_TEMPORARILY_LOCKED = 1020;

/** Số giây còn bị khóa tạm sau nhiều lần sai mật khẩu (AUTH-03); không phải lỗi khóa tạm ⇒ 0. */
export const loginLockSeconds = (err) =>
  err?.errorCode === LOGIN_TEMPORARILY_LOCKED ? Math.max(0, Math.ceil(Number(err.details?.retryAfterSeconds) || 0)) : 0;
