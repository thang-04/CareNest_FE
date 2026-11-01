/*
 * Shared validation of the school-config module (UI + mock server).
 * Each function returns { field: message }; `others` are the existing records used for duplicate checks.
 * Rules: Academic Year / Age Group / Class / Campus entities (SRS 3.2), UC 2.1–2.7, screens 4.1.2–4.1.5, GBR-CFG-02, MSG19/MSG20.
 */
import { formatDate, isIsoDate, normalizeText } from '@/utils/format';
import { MEAL_SESSION_OPTIONS, TEACHERS_PER_CLASS } from '@/models/school-config/schoolConfigConstants';

const same = (a, b) => normalizeText((a || '').trim()) === normalizeText((b || '').trim());
const YEAR_NAME = /^(\d{4})-(\d{4})$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// Số điện thoại Việt Nam (như CampusRequest.phone của BE): di động 10 số 03/05/07/08/09, cố định 11 số 02x
const VN_PHONE = /^0(?:[35789]\d{8}|2\d{9})$/;
export const PHONE_MESSAGE = 'Số điện thoại không đúng định dạng Việt Nam (VD: 0912345678)';
/** Bỏ dấu cách, dấu chấm, gạch ngang; +84 / 84 đầu số đổi thành 0. */
export const normalizePhone = (raw) => {
  const digits = String(raw ?? '').replace(/[\s.\-()]/g, '');
  return digits.replace(/^\+?84(?=\d{9,10}$)/, '0');
};
export const isVnPhone = (raw) => VN_PHONE.test(normalizePhone(raw));
// Số nguyên lớn nhất BE nhận cho sĩ số / sức chứa (@Max(Short.MAX_VALUE))
export const MAX_SIZE = 32767;

// Độ dài tối đa theo DTO BE (@Size): ô nhập không chặn gõ, vượt thì báo lỗi dưới ô
export const CAMPUS_LIMITS = {
  code: [30, 'Mã điểm trường'],
  shortName: [50, 'Tên ngắn'],
  name: [150, 'Tên đầy đủ'],
  address: [255, 'Địa chỉ'],
};
export const ROOM_LIMITS = { room: [20, 'Mã phòng'], name: [50, 'Tên phòng'], note: [500, 'Ghi chú'] };
export const AGE_GROUP_LIMITS = { name: [50, 'Tên nhóm tuổi'], shortName: [50, 'Tên ngắn'], nutritionNote: [500, 'Ghi chú dinh dưỡng'] };
export const CLASS_LIMITS = { name: [50, 'Tên lớp'] };
export const CUTOFF_LIMITS = { note: [500, 'Ghi chú'] };

/** Lỗi vượt độ dài của các field trong `limits`. */
export const lengthErrors = (form, limits) =>
  Object.fromEntries(
    Object.entries(limits)
      .filter(([field, [max]]) => String(form[field] ?? '').trim().length > max)
      .map(([field, [max, label]]) => [field, `${label} tối đa ${max} ký tự (đang ${String(form[field]).trim().length})`]),
  );
const withLength = (e, form, limits) => ({ ...lengthErrors(form, limits), ...e });

/**
 * Lỗi sau khi người dùng sửa các field trong `patch`: xóa lỗi cũ của field đó, báo ngay nếu vượt độ dài
 * (các lỗi khác vẫn báo khi rời ô / bấm lưu). Lỗi chung của form (`_form`) cũng xóa.
 */
export const errorsAfterChange = (prev, patch, nextForm, limits) => {
  const live = lengthErrors(nextForm, limits);
  const next = { ...prev };
  delete next._form;
  Object.keys(patch).forEach((k) => {
    if (live[k]) next[k] = live[k];
    else delete next[k];
  });
  return next;
};

export const hasErrors = (e) => Object.keys(e).length > 0;
export const firstError = (e) => Object.values(e)[0];

export const validateSchoolYear = (form, others = [], { creating = false } = {}) => {
  const e = {};
  const name = (form.name || '').trim();
  const m = YEAR_NAME.exec(name);
  if (!name) e.name = 'Nhập tên năm học, ví dụ 2027-2028';
  else if (!m || Number(m[2]) !== Number(m[1]) + 1)
    e.name = 'Tên năm học có dạng NNNN-NNNN, năm sau lớn hơn năm trước 1 năm (ví dụ 2027-2028)';
  else if (others.some((y) => y.name === name)) e.name = 'Năm học này đã tồn tại. Hãy xem lại năm học đã có.';
  if (!form.startDate) e.startDate = 'Chọn ngày bắt đầu';
  else if (!isIsoDate(form.startDate)) e.startDate = 'Ngày bắt đầu không hợp lệ, nhập dạng dd/mm/yyyy (ví dụ 05/09/2027)';
  if (!form.endDate) e.endDate = 'Chọn ngày kết thúc';
  else if (!isIsoDate(form.endDate)) e.endDate = 'Ngày kết thúc không hợp lệ, nhập dạng dd/mm/yyyy (ví dụ 31/05/2028)';
  else if (!e.startDate && form.endDate <= form.startDate) e.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
  if (!e.startDate && !e.endDate) {
    const overlap = others.find((y) => form.startDate <= y.endDate && y.startDate <= form.endDate);
    if (overlap)
      e.endDate = `Khoảng thời gian trùng với năm học ${overlap.name} (${formatDate(overlap.startDate)} – ${formatDate(overlap.endDate)})`;
  }
  // CFG-YR-03: năm mới nối tiếp năm mới nhất (tên = năm mới nhất + 1, bắt đầu sau ngày kết thúc năm đó)
  const latest = creating ? [...others].sort((a, b) => b.startDate.localeCompare(a.startDate))[0] : null;
  const latestName = latest && YEAR_NAME.exec(latest.name);
  if (latestName && !e.name && m && Number(m[1]) !== Number(latestName[1]) + 1) {
    const from = Number(latestName[1]) + 1;
    e.name = `Năm học tiếp theo phải là ${from}-${from + 1} (sau năm ${latest.name})`;
  }
  if (latest && !e.startDate && !e.endDate && form.startDate <= latest.endDate)
    e.startDate = `Ngày bắt đầu phải sau ngày kết thúc năm học ${latest.name} (${formatDate(latest.endDate)})`;
  return e;
};

const isInt = (v, min, max) => v !== '' && v != null && Number.isInteger(Number(v)) && Number(v) >= min && Number(v) <= max;

/**
 * Age Group Form (SRS 4.1.4). maxClassSize = maximum children per class of the group, set by the Principal.
 * `blockingClasses`: classes of non-ended years whose max size or enrolled count is above the new value (listed in the error).
 */
export const validateAgeGroup = (form, others = [], { blockingClasses = [] } = {}) => {
  const e = {};
  const name = (form.name || '').trim();
  if (!name) e.name = 'Nhập tên nhóm tuổi';
  else if (others.some((g) => same(g.name, name))) e.name = 'Tên nhóm tuổi đã tồn tại';
  if (!form.shortName?.trim()) e.shortName = 'Nhập tên ngắn';
  if (!form.mealSessions?.length) e.mealSessions = 'Chọn ít nhất một bữa ăn trong ngày';
  else if (form.mealSessions.some((s) => !MEAL_SESSION_OPTIONS.includes(s))) e.mealSessions = 'Bữa ăn không hợp lệ';
  const from = Number(form.ageFromMonths);
  const to = Number(form.ageToMonths);
  if (!isInt(form.ageFromMonths, 0, 72)) e.ageFromMonths = 'Độ tuổi từ là số tháng nguyên từ 0 đến 72';
  if (!isInt(form.ageToMonths, 1, 72)) e.ageToMonths = 'Độ tuổi đến là số tháng nguyên từ 1 đến 72';
  else if (!e.ageFromMonths && to <= from) e.ageToMonths = 'Độ tuổi đến phải lớn hơn độ tuổi từ';
  if (!e.ageFromMonths && !e.ageToMonths) {
    // Khoảng [từ, đến): 24–36 và 36–48 không trùng nhau
    const overlap = others.find((g) => g.ageFromMonths != null && from < g.ageToMonths && g.ageFromMonths < to);
    if (overlap)
      e.ageToMonths = `Độ tuổi trùng với nhóm ${overlap.shortName || overlap.name} (${overlap.ageFromMonths}–${overlap.ageToMonths} tháng)`;
  }
  if (!isInt(form.maxClassSize, 1, MAX_SIZE)) e.maxClassSize = `Sĩ số tối đa / lớp là số nguyên từ 1 đến ${MAX_SIZE}`;
  else {
    const over = blockingClasses.filter((c) => Math.max(c.capacity, c.childCount || 0) > Number(form.maxClassSize));
    if (over.length)
      e.maxClassSize = `Không hạ được: ${over.map((c) => `${c.name} (${c.childCount || 0}/${c.capacity})`).join(', ')} đang vượt ${form.maxClassSize} trẻ. Giảm sĩ số các lớp đó trước.`;
  }
  return withLength(e, form, AGE_GROUP_LIMITS);
};

/**
 * Class Form (SRS 4.1.5). SRS: class names unique within a school year; kept per year + campus because the demo data has
 * "Lớp Mầm 1" at both campuses (OPEN – team to confirm).
 * Capacity: from `enrolled` (min 1) to min(age group max per class, capacity of the `room`) (decision 10/10/2026).
 */
export const validateClass = (form, others = [], { ageGroup = null, room = null, enrolled = 0 } = {}) => {
  const e = {};
  const name = (form.name || '').trim();
  if (!name) e.name = 'Nhập tên lớp';
  else if (others.some((c) => c.schoolYear === form.schoolYear && c.campusId === form.campusId && same(c.name, name)))
    e.name = 'Điểm trường đã có lớp cùng tên trong năm học này';
  if (!form.campusId) e.campusId = 'Chọn điểm trường';
  if (!form.ageGroupId) e.ageGroupId = 'Chọn nhóm tuổi';
  if (!form.schoolYear) e.schoolYear = 'Chọn năm học';
  if (!form.locationId) e.locationId = 'Chọn phòng học';
  const min = Math.max(1, enrolled);
  // Không vượt sĩ số tối đa của nhóm tuổi và sức chứa phòng
  const { max, reason } = classSizeLimit(ageGroup, room);
  const range = reason ? `đến ${max} (${reason})` : 'trở lên';
  if (!isInt(form.capacity, min, max))
    e.capacity = enrolled > 0 ? `Sĩ số tối đa từ ${min} (số trẻ đang học) ${range}` : `Sĩ số tối đa từ 1 ${range}`;
  else if (room?.capacity && enrolled > room.capacity) e.locationId = `Sức chứa phòng là ${room.capacity}, lớp đang có ${enrolled} trẻ`;
  return withLength(e, form, CLASS_LIMITS);
};

/** Max size of a class = min(age group max per class, room capacity), with the reason shown to the user. */
export const classSizeLimit = (ageGroup, room) => {
  const g = ageGroup?.maxClassSize || null;
  const r = room?.capacity || null;
  if (!g && !r) return { max: MAX_SIZE, reason: '' };
  const max = Math.min(g || Infinity, r || Infinity);
  const parts = [g && `nhóm ${ageGroup.shortName} tối đa ${g}`, r && `phòng ${room.room} sức chứa ${r}`].filter(Boolean);
  const by = g && (!r || g <= r) ? 'theo nhóm tuổi' : 'theo sức chứa phòng';
  return { max, reason: `${by}: ${parts.join(', ')}` };
};

export const validateCutoff = (form, year) => {
  const e = {};
  if (!form.time) e.time = 'Nhập giờ chốt';
  else if (!TIME.test(form.time)) e.time = 'Nhập giờ hợp lệ dạng HH:mm, ví dụ 08:45';
  if (!form.effectiveFrom) e.effectiveFrom = 'Chọn ngày áp dụng';
  else if (year && (form.effectiveFrom < year.startDate || form.effectiveFrom > year.endDate))
    e.effectiveFrom = `Ngày áp dụng phải nằm trong năm học ${year.name}`;
  return withLength(e, form, CUTOFF_LIMITS);
};

export const validateCampus = (form, others = []) => {
  const e = {};
  if (!form.code?.trim()) e.code = 'Nhập mã điểm trường';
  else if (form.code.trim().length > 30) e.code = 'Mã điểm trường tối đa 30 ký tự';
  else if (others.some((c) => same(c.code, form.code))) e.code = 'Mã điểm trường đã tồn tại';
  if (!form.name?.trim()) e.name = 'Nhập tên điểm trường';
  else if (others.some((c) => same(c.name, form.name))) e.name = 'Tên điểm trường đã tồn tại';
  if (!form.shortName?.trim()) e.shortName = 'Nhập tên ngắn';
  if (!form.address?.trim()) e.address = 'Nhập địa chỉ';
  if (form.phone?.trim() && !isVnPhone(form.phone)) e.phone = PHONE_MESSAGE;
  return withLength(e, form, CAMPUS_LIMITS);
};

export const validateVpAssignment = (form) => {
  const e = {};
  if (!form.campusId) e.campusId = 'Chọn điểm trường phụ trách';
  return e;
};

/**
 * Lớp có 0–2 giáo viên. Hộp phân công bắt buộc tích chủ nhiệm khi có giáo viên; gỡ giáo viên thì lớp được để trống
 * chủ nhiệm (`requireHomeroom: false`). Kích hoạt năm học cần mọi lớp có giáo viên và chủ nhiệm.
 */
export const validateClassTeachers = (form, { requireHomeroom = true } = {}) => {
  const e = {};
  const count = form.teacherIds?.length || 0;
  if (count > TEACHERS_PER_CLASS) e.teacherIds = `Mỗi lớp tối đa ${TEACHERS_PER_CLASS} giáo viên`;
  if (requireHomeroom && count > 0 && !form.homeroomTeacherId) e.homeroomTeacherId = 'Chọn giáo viên chủ nhiệm';
  else if (form.homeroomTeacherId && !form.teacherIds?.includes(form.homeroomTeacherId))
    e.homeroomTeacherId = 'Giáo viên chủ nhiệm phải nằm trong danh sách giáo viên của lớp';
  return e;
};

export const validatePermissionChange = (form) => {
  const e = {};
  if (!form.reason?.trim()) e.reason = 'Nhập lý do thay đổi quyền';
  return e;
};

/**
 * Room Form (PROPOSED 10/10/2026, outside SRS): code unique within the campus; classrooms need a capacity set by the
 * Principal (positive integer, no fixed maximum) not below
 * the largest class size using the room (`minCapacity`).
 */
export const validateRoom = (form, others = [], { minCapacity = 0 } = {}) => {
  const e = {};
  const code = (form.room || '').trim();
  const name = (form.name || '').trim();
  if (!form.campusId) e.campusId = 'Chọn điểm trường';
  if (!code) e.room = 'Nhập mã/số phòng, ví dụ P.101';
  else if (others.some((l) => l.campusId === form.campusId && same(l.room, code))) e.room = 'Điểm trường đã có phòng cùng mã';
  if (!name) e.name = 'Nhập tên phòng';
  // Cùng mã / tên được phép ở hai điểm trường khác nhau (Phòng 101 Campus 1 và Campus 2)
  else if (others.some((l) => l.campusId === form.campusId && same(l.name, name))) e.name = 'Điểm trường đã có phòng cùng tên';
  if (!form.type) e.type = 'Chọn loại phòng';
  if (form.type === 'CLASS' || (form.capacity !== '' && form.capacity != null)) {
    if (form.capacity === '' || form.capacity == null) e.capacity = 'Nhập sức chứa của phòng học';
    else if (!isInt(form.capacity, 1, MAX_SIZE)) e.capacity = `Sức chứa là số nguyên từ 1 đến ${MAX_SIZE}`;
    else if (form.type === 'CLASS' && Number(form.capacity) < minCapacity)
      e.capacity = `Lớp đang dùng phòng có sĩ số tối đa ${minCapacity}, sức chứa không được nhỏ hơn`;
  }
  return withLength(e, form, ROOM_LIMITS);
};

// Email có tên miền cấp cao ≥ 2 chữ cái (vd. .vn, .com)
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)*\.[A-Za-z]{2,}$/;
// Họ tên: chữ cái (gồm tiếng Việt có dấu) và dấu cách
const PERSON_NAME = /^[\p{L}\s]+$/u;
export const STAFF_LIMITS = { fullName: [100, 'Họ tên'], email: [255, 'Email'] };
const checkStaffCommon = (form, others, e) => {
  const name = (form.fullName || '').trim().replace(/\s+/g, ' ');
  if (!name) e.fullName = 'Nhập họ tên';
  else if (!PERSON_NAME.test(name)) e.fullName = 'Họ tên chỉ gồm chữ cái và dấu cách';
  else if (name.length < 2) e.fullName = 'Họ tên tối thiểu 2 ký tự';
  const email = (form.email || '').trim().toLowerCase();
  if (!email) e.email = 'Nhập email';
  else if (!EMAIL.test(email)) e.email = 'Email không đúng định dạng (VD: ten@truong.edu.vn)';
  else if (others.some((u) => (u.email || '').trim().toLowerCase() === email)) e.email = 'Email đã được dùng cho tài khoản khác';
  if (form.phone?.trim() && !isVnPhone(form.phone)) e.phone = PHONE_MESSAGE;
  return withLength(e, form, STAFF_LIMITS);
};
/** Staff account (PROPOSED): roles the Principal may give; Teacher and Kitchen staff need a campus. */
export const STAFF_ROLE_OPTIONS = ['VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF'];
export const validateStaffAccount = (form, others = []) => {
  const e = {};
  if (!STAFF_ROLE_OPTIONS.includes(form.role)) e.role = 'Chọn vai trò';
  if (form.role !== 'VICE_PRINCIPAL' && !form.campusId) e.campusId = 'Chọn điểm trường';
  return checkStaffCommon(form, others, e);
};

/** Hồ sơ nhân sự (PHT được sửa): họ tên, email, SĐT, ngày sinh, trình độ, ghi chú. */
export const validateStaffProfile = (form, others = []) => {
  const e = {};
  if (form.dateOfBirth && !isIsoDate(form.dateOfBirth)) e.dateOfBirth = 'Ngày sinh không hợp lệ, nhập dạng dd/mm/yyyy';
  if ((form.qualification || '').length > 200) e.qualification = 'Trình độ tối đa 200 ký tự';
  if ((form.note || '').length > 500) e.note = 'Ghi chú tối đa 500 ký tự';
  return checkStaffCommon(form, others, e);
};
