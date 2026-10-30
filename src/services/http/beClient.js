import axios from 'axios';
import { DEV_BE_BASE_URL } from '@/config/env';
import { BE_ERROR_FIELDS } from './beErrorFields';
import { translateBeError } from './beErrorMessages';
import { getDevAccessToken, tokenForRetry } from './devKeycloakAuth';
import { UNAUTHORIZED_EVENT } from './tokenStorage';

/*
 * Client cho API BE thật của Cấu hình trường (VITE_SCHOOL_CONFIG_API=true). Tách khỏi axiosClient chung để module
 * khác (vẫn mock) không bị ảnh hưởng. Chuyển đổi giữa dạng BE và dạng UI đang dùng:
 * - BE bọc { code, errorCode, desc, data } ⇒ trả về data. Lỗi có errorCode: desc đã là câu tiếng Việt, gắn vào ô theo
 *   BE_ERROR_FIELDS; lỗi validation (9001) data=[{field,message}] ⇒ details {field: message}.
 * - BE dùng id số; UI dùng id chuỗi ⇒ response: id/xxxId thành chuỗi; request: chuỗi số thành số.
 * - Năm học: UI dùng tên ('2026-2027') làm id (bộ chọn năm, module mock khác) ⇒ đổi tên <-> id số của BE.
 */
const YEAR_NAME = /^\d{4}-\d{4}$/;
const YEAR_KEYS = new Set(['schoolYear', 'schoolYearId', 'yearId', 'sourceYearId', 'targetYearId']);
const isIdKey = (key) => key === 'id' || /Id$/.test(key);
const isIdsKey = (key) => /Ids$/.test(key);

let years = null; // [{ id: number, name: string }]
const yearName = (id) => years?.find((y) => y.id === Number(id))?.name ?? id;
const yearId = (name) => years?.find((y) => y.name === name)?.id ?? name;

const raw = axios.create({ baseURL: DEV_BE_BASE_URL, timeout: 15000, headers: { 'Content-Type': 'application/json' } });
raw.interceptors.request.use(async (config) => {
  const token = await getDevAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
// 401 giữa chừng: làm mới token (chung với axiosClient) rồi gửi lại một lần; vẫn 401 thì call() báo hết phiên
raw.interceptors.response.use(undefined, async (error) => {
  if (error.response?.status === 401 && error.config && !error.config.devRetried) {
    const fresh = await tokenForRetry(error.config.headers?.Authorization);
    if (fresh) {
      error.config.devRetried = true;
      error.config.headers.Authorization = `Bearer ${fresh}`;
      return raw.request(error.config);
    }
  }
  return Promise.reject(error);
});

const loadYears = async () => {
  try {
    const { data } = await raw.get('/school-years');
    years = data.data.map((y) => ({ id: y.id, name: y.name }));
  } catch (error) {
    // Vai trò không xem được danh sách năm học (bếp): không đổi tên <-> id năm, BE dùng năm đang hoạt động
    if (error.response?.status !== 403) throw error;
    years = [];
  }
};

let loading = null; // gộp các lần nạp đồng thời
const ensureYears = async (refresh = false) => {
  if (years && !refresh) return;
  loading ||= loadYears().finally(() => {
    loading = null;
  });
  await loading;
};

const toNumberIfNumeric = (v) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v);

// UI -> BE (ô số / chọn để trống '' ⇒ null, BE không nhận chuỗi rỗng cho số/id)
const toBe = (value, key) => {
  if (value === '' && key) return null;
  if (Array.isArray(value)) return value.map((v) => (isIdsKey(key || '') ? toNumberIfNumeric(v) : toBe(v)));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toBe(v, k)]));
  }
  if (key && YEAR_KEYS.has(key) && typeof value === 'string' && YEAR_NAME.test(value)) return yearId(value);
  if (key && (isIdKey(key) || isIdsKey(key))) return toNumberIfNumeric(value);
  return value;
};

// BE -> UI
const toUi = (value, key) => {
  if (Array.isArray(value)) return value.map((v) => toUi(v, isIdsKey(key || '') ? key : undefined));
  if (value && typeof value === 'object') {
    const isYear = typeof value.name === 'string' && YEAR_NAME.test(value.name) && value.id != null;
    const out = Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toUi(v, k)]));
    if (isYear) {
      out.beId = value.id;
      out.id = value.name;
    }
    return out;
  }
  if (key && YEAR_KEYS.has(key) && typeof value === 'number') return yearName(value);
  if (key && (isIdKey(key) || isIdsKey(key)) && typeof value === 'number') return String(value);
  return value;
};

/** { message, details } từ lỗi có errorCode; validation (data là danh sách lỗi theo ô) dùng lại bảng dịch theo field. */
const fromErrorCode = (errorCode, desc, data) => {
  if (Array.isArray(data) && data.length) return translateBeError(desc, data);
  return { message: desc, details: { [BE_ERROR_FIELDS[errorCode] || '_form']: desc } };
};

const normalizeError = (error) => {
  const status = error.response?.status ?? 0;
  const body = error.response?.data;
  // 400/409: câu tiếng Việt gắn vào ô nhập (details) hoặc lỗi chung của form (details._form)
  const errorCode = body?.errorCode ?? null;
  // Có errorCode (mã tập trung của BE): hiện thẳng desc; chưa có (BE cũ) thì dịch desc tiếng Anh theo bảng cũ
  const known =
    errorCode != null
      ? fromErrorCode(errorCode, body?.desc, body?.data)
      : status === 400 || status === 409
        ? translateBeError(body?.desc, body?.data)
        : null;
  const message = known?.message || body?.desc || (status === 0 ? 'Không thể kết nối máy chủ' : error.message);
  const normalized = new Error(message);
  normalized.status = status;
  normalized.errorCode = errorCode;
  if (known) normalized.details = known.details;
  else if (status === 400 || status === 409) {
    // desc BE chưa có trong bảng dịch: không hiện câu tiếng Anh cho người dùng
    normalized.message =
      status === 400
        ? 'Dữ liệu chưa hợp lệ, kiểm tra lại các ô đã nhập'
        : 'Dữ liệu vừa bị thay đổi hoặc bị trùng, tải lại trang rồi thử lại';
    normalized.details = { _form: normalized.message };
  }
  return normalized;
};

// Đường dẫn /school-years/{tên năm}/... ⇒ /school-years/{id số}/...
const mapPath = (url) =>
  url.replace(/\/school-years\/([^/?]+)/, (m, seg) =>
    YEAR_NAME.test(decodeURIComponent(seg)) ? `/school-years/${yearId(decodeURIComponent(seg))}` : m,
  );

// Tên năm học trong request mà bảng tên <-> id chưa có (năm vừa tạo / tạo lại ở tab khác) ⇒ nạp lại bảng
const hasUnknownYear = (...parts) =>
  (JSON.stringify(parts).match(/\d{4}-\d{4}/g) || []).some((name) => !years?.some((y) => y.name === name));

const call = async (method, url, { params, data } = {}) => {
  try {
    await ensureYears();
    if (hasUnknownYear(decodeURIComponent(url), params, data)) await ensureYears(true);
    const response = await raw.request({ method, url: mapPath(url), params: toBe(params), data: toBe(data) });
    // Năm học thay đổi ⇒ nạp lại bảng tên <-> id
    if (method !== 'get' && url.startsWith('/school-years')) await ensureYears(true);
    return toUi(response.data.data);
  } catch (error) {
    // Token bị BE từ chối ⇒ luồng hết phiên chung (AuthContext đăng xuất)
    if (error.response?.status === 401) window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw normalizeError(error);
  }
};

export const beClient = {
  get: (url, config = {}) => call('get', url, { params: config.params }),
  post: (url, data, config = {}) => call('post', url, { data, params: config.params }),
  put: (url, data, config = {}) => call('put', url, { data, params: config.params }),
  patch: (url, data, config = {}) => call('patch', url, { data, params: config.params }),
  delete: (url, config = {}) => call('delete', url, { params: config.params }),
};
