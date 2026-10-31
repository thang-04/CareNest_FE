import { AUTH_USE_MOCK } from '@/config/env';

export const AUTH_OPERATION_KEY = 'carenest.auth.operation';
export const AUTH_TAB_ID = Math.random().toString(36).slice(2);
const TYPES = ['login', 'logout', 'password'];
const unavailable = () =>
  Object.assign(
    new Error('Trình duyệt chưa hỗ trợ phối hợp phiên an toàn. Vui lòng dùng trình duyệt cập nhật và cho phép dữ liệu trang.'),
    { status: 503 },
  );
const changed = () => Object.assign(new Error('Phiên đăng nhập đã thay đổi ở tab khác. Vui lòng thực hiện lại.'), { status: 409 });

export const readAuthOperation = () => {
  try {
    const value = localStorage.getItem(AUTH_OPERATION_KEY);
    if (!value) return { version: 0, type: null, source: null, restoreBlocked: false };
    const operation = JSON.parse(value);
    if (!Number.isSafeInteger(operation.version) || operation.version < 0 || !TYPES.includes(operation.type)) throw unavailable();
    return { ...operation, restoreBlocked: operation.restoreBlocked ?? operation.type === 'logout' };
  } catch {
    throw unavailable();
  }
};

const saveOperation = (operation) => {
  try {
    localStorage.setItem(AUTH_OPERATION_KEY, JSON.stringify(operation));
  } catch {
    throw unavailable();
  }
  return operation;
};

// Chỉ metadata, không credential; version đọc dưới cùng lock với HTTP đặt/xóa cookie.
export const withAuthOperation = async (type, action) => {
  if (AUTH_USE_MOCK) return action(null);
  const expected = readAuthOperation().version;
  if (!globalThis.navigator?.locks?.request) throw unavailable();
  return navigator.locks.request('carenest.auth.cookie-boundary', async () => {
    const latest = readAuthOperation();
    if (type !== 'logout' && expected !== latest.version) throw changed();
    if (latest.version >= Number.MAX_SAFE_INTEGER) throw unavailable();
    const operation = saveOperation({
      version: latest.version + 1,
      type,
      source: AUTH_TAB_ID,
      restoreBlocked: type === 'login' || type === 'logout' ? true : latest.restoreBlocked,
    });
    return action(operation);
  });
};

export const completeAuthOperation = (operation, type) => {
  if (!operation) return null;
  if (readAuthOperation().version !== operation.version) throw changed();
  return saveOperation({
    ...operation,
    type,
    restoreBlocked: type === 'logout' ? true : type === 'login' ? false : operation.restoreBlocked,
  });
};
