import { normalizeText } from '@/utils/format';
import { ROLES, ROLE_LABELS } from '@/models/User';

/** Tài khoản nhân sự › nhập / xuất Excel (Cần 31/10/2026). Giới hạn khớp BE `CreateAccountRequest` (AUTH-15, AUTH-21). */
export const STAFF_TEMPLATE_URL = '/templates/tai-khoan-nhan-su-mau.xlsx';
export const STAFF_SHEET = 'Nhân sự';
export const STAFF_COLUMNS = ['Họ tên', 'Số điện thoại', 'Email', 'Vai trò', 'Điểm trường', 'Lớp'];
export const STAFF_ROLES = [ROLES.VICE_PRINCIPAL, ROLES.TEACHER, ROLES.KITCHEN_STAFF];
export const NAME_MAX = 150;
export const EMAIL_MAX = 255;

const text = (v) =>
  String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ');
const key = (v) => normalizeText(text(v));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Di động 10 số đầu 03/05/07/08/09; BE nhận SĐT 10 số bắt đầu 0 làm tên đăng nhập (PhoneNumbers)
const MOBILE = /^0[35789]\d{8}$/;

/** "+84 912.345.678" → "0912345678"; trả '' khi không phải SĐT di động Việt Nam hợp lệ. */
export const normalizePhone = (raw) => {
  let digits = text(raw).replace(/[\s.\-()]/g, '');
  if (digits.startsWith('+84')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('84') && digits.length === 11) digits = `0${digits.slice(2)}`;
  // Excel đổi ô số thành số và mất số 0 đầu ("912345678")
  else if (/^[35789]\d{8}$/.test(digits)) digits = `0${digits}`;
  return MOBILE.test(digits) ? digits : '';
};

/** Lỗi theo ô của một tài khoản (form tạo và từng dòng Excel dùng chung). */
export function validateStaffAccount(form, { campuses = [], classes = [] } = {}) {
  const e = {};
  const name = text(form.fullName);
  if (!name) e.fullName = 'Nhập họ tên';
  else if (name.length > NAME_MAX) e.fullName = `Họ tên tối đa ${NAME_MAX} ký tự`;
  if (!text(form.phone)) e.phone = 'Nhập số điện thoại';
  else if (!normalizePhone(form.phone)) e.phone = 'Số điện thoại di động gồm 10 số, bắt đầu bằng 03, 05, 07, 08 hoặc 09';
  const email = text(form.email);
  if (email && (email.length > EMAIL_MAX || !EMAIL.test(email))) e.email = 'Email không đúng định dạng';
  if (!STAFF_ROLES.includes(form.role)) e.role = 'Chọn vai trò';
  else if (form.role === ROLES.TEACHER) {
    if (!form.classroomId) e.classroomId = 'Chọn lớp';
    else if (!classes.some((c) => String(c.id) === String(form.classroomId))) e.classroomId = 'Lớp không có trong năm học';
  } else if (!form.campusId) e.campusId = 'Chọn điểm trường';
  else if (!campuses.some((c) => String(c.id) === String(form.campusId))) e.campusId = 'Điểm trường không tồn tại';
  return e;
}

/** Body POST /accounts: PHT / bếp gắn điểm trường, GV gắn lớp (BE AUTH-15). */
export const toCreatePayload = (form) => ({
  phone: normalizePhone(form.phone),
  fullName: text(form.fullName),
  email: text(form.email) || null,
  role: form.role,
  assignment: form.role === ROLES.TEACHER ? { classroomId: form.classroomId } : { campusId: form.campusId },
});

const findCampus = (campuses, v) => campuses.find((c) => [c.shortName, c.name, c.code].some((x) => x && key(x) === key(v))) || null;
const roleOf = (v) => STAFF_ROLES.find((r) => key(ROLE_LABELS[r]) === key(v) || key(r) === key(v)) || '';

/**
 * Sheet "Nhân sự" → { items, errors }. Kiểm như form tạo; trùng SĐT / email trong file hoặc với tài khoản đã có thì báo lỗi dòng.
 * existing: [{ phone, email }] của tài khoản đang có. BE kiểm lại khi lưu.
 */
export function matchStaffRows(rows, { campuses = [], classes = [], existing = [] }) {
  const errors = [];
  const items = [];
  if (!rows) return { items, errors: [{ row: '—', name: '—', reason: `Thiếu sheet "${STAFF_SHEET}". Hãy tải file mẫu và điền lại.` }] };
  const [header, ...body] = rows;
  if (!header || STAFF_COLUMNS.some((c, i) => key(header[i]) !== key(c))) {
    return { items, errors: [{ row: 1, name: '—', reason: 'Dòng tiêu đề không đúng file mẫu.' }] };
  }
  const phones = new Set(existing.map((a) => normalizePhone(a.phone)).filter(Boolean));
  const emails = new Set(existing.map((a) => key(a.email)).filter(Boolean));
  body.forEach((cells = [], i) => {
    const [fullName, phone, email, roleText, campusText, classText] = STAFF_COLUMNS.map((_, j) => text(cells[j]));
    if (![fullName, phone, email, roleText, campusText, classText].some(Boolean)) return;
    const row = i + 2;
    const campus = campusText ? findCampus(campuses, campusText) : null;
    const role = roleOf(roleText);
    const cls = classText
      ? classes.find((c) => key(c.name) === key(classText) && (!campus || String(c.campusId) === String(campus.id))) || null
      : null;
    const form = { fullName, phone, email, role, campusId: campus?.id || '', classroomId: cls?.id || '' };
    const e = validateStaffAccount(form, { campuses, classes });
    if (roleText && !role) e.role = `Vai trò "${roleText}" không đúng (Phó hiệu trưởng, Giáo viên, Nhân viên bếp)`;
    if (campusText && !campus) e.campusId = `Không có điểm trường "${campusText}"`;
    if (classText && !cls) e.classroomId = `Không có lớp "${classText}"${campus ? ` ở ${campus.shortName || campus.name}` : ''}`;
    const p = normalizePhone(phone);
    if (p && phones.has(p)) e.phone = `Số điện thoại ${p} đã có tài khoản hoặc trùng trong file`;
    if (email && emails.has(key(email))) e.email = `Email ${email} đã có tài khoản hoặc trùng trong file`;
    const reasons = [...new Set(Object.values(e))];
    if (reasons.length) {
      errors.push({ row, name: fullName || '—', reason: reasons.join('; ') });
      return;
    }
    if (p) phones.add(p);
    if (email) emails.add(key(email));
    items.push({ row, form, campusName: campus?.shortName || campus?.name || '', className: cls?.name || '' });
  });
  return { items, errors };
}

/** Dòng xuất file theo cùng cột file mẫu (thêm Trạng thái), để sửa rồi nhập lại được. */
export const staffExportRows = (accounts) => [
  [...STAFF_COLUMNS, 'Trạng thái'],
  ...accounts.map((a) => [
    a.fullName,
    a.phone || '',
    a.email || '',
    ROLE_LABELS[a.role] || a.role || '',
    a.campusNames.join(', '),
    a.classNames.join(', '),
    a.status === 'INACTIVE' ? 'Đã vô hiệu hóa' : 'Đang hoạt động',
  ]),
];
