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
const PHONE = /^[0-9 +().-]{8,20}$/;

export const hasErrors = (e) => Object.keys(e).length > 0;
export const firstError = (e) => Object.values(e)[0];

export const validateSchoolYear = (form, others = []) => {
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
  else if (name.length > 50) e.name = 'Tên nhóm tuổi tối đa 50 ký tự';
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
  if (!isInt(form.maxClassSize, 1, Number.MAX_SAFE_INTEGER)) e.maxClassSize = 'Sĩ số tối đa / lớp là số nguyên lớn hơn 0';
  else {
    const over = blockingClasses.filter((c) => Math.max(c.capacity, c.childCount || 0) > Number(form.maxClassSize));
    if (over.length)
      e.maxClassSize = `Không hạ được: ${over.map((c) => `${c.name} (${c.childCount || 0}/${c.capacity})`).join(', ')} đang vượt ${form.maxClassSize} trẻ. Giảm sĩ số các lớp đó trước.`;
  }
  return e;
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
  else if (name.length > 50) e.name = 'Tên lớp tối đa 50 ký tự';
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
  return e;
};

/** Max size of a class = min(age group max per class, room capacity), with the reason shown to the user. */
export const classSizeLimit = (ageGroup, room) => {
  const g = ageGroup?.maxClassSize || null;
  const r = room?.capacity || null;
  if (!g && !r) return { max: Number.MAX_SAFE_INTEGER, reason: '' };
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
  const reopen = String(form.reopenWindowMinutes ?? '').trim();
  if (!reopen) e.reopenWindowMinutes = 'Nhập số phút được mở lại sau giờ chốt (0 = không cho mở lại)';
  else if (!/^\d+$/.test(reopen) || Number(reopen) > 600) e.reopenWindowMinutes = 'Nhập số phút nguyên từ 0 đến 600';
  return e;
};

export const validateCampus = (form, others = []) => {
  const e = {};
  if (!form.code?.trim()) e.code = 'Nhập mã điểm trường';
  else if (others.some((c) => same(c.code, form.code))) e.code = 'Mã điểm trường đã tồn tại';
  if (!form.name?.trim()) e.name = 'Nhập tên điểm trường';
  else if (others.some((c) => same(c.name, form.name))) e.name = 'Tên điểm trường đã tồn tại';
  if (!form.shortName?.trim()) e.shortName = 'Nhập tên ngắn';
  if (!form.address?.trim()) e.address = 'Nhập địa chỉ';
  if (form.phone && !PHONE.test(form.phone.trim())) e.phone = 'Số điện thoại chỉ gồm chữ số, dài 8–20 ký tự';
  return e;
};

export const validateVpAssignment = (form) => {
  const e = {};
  if (!form.campusId) e.campusId = 'Chọn điểm trường phụ trách';
  return e;
};

/** Mỗi lớp đúng 2 giáo viên, chủ nhiệm do người phân công tự chọn trong 2 người đó. */
export const validateClassTeachers = (form) => {
  const e = {};
  if ((form.teacherIds?.length || 0) !== TEACHERS_PER_CLASS) e.teacherIds = `Chọn đủ ${TEACHERS_PER_CLASS} giáo viên cho lớp`;
  if (form.teacherIds?.length && !form.homeroomTeacherId) e.homeroomTeacherId = 'Chọn giáo viên chủ nhiệm';
  if (form.homeroomTeacherId && !form.teacherIds?.includes(form.homeroomTeacherId))
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
  else if (code.length > 20) e.room = 'Mã phòng tối đa 20 ký tự';
  else if (others.some((l) => l.campusId === form.campusId && same(l.room, code))) e.room = 'Điểm trường đã có phòng cùng mã';
  if (!name) e.name = 'Nhập tên phòng';
  else if (name.length > 50) e.name = 'Tên phòng tối đa 50 ký tự';
  // Cùng mã / tên được phép ở hai điểm trường khác nhau (Phòng 101 Campus 1 và Campus 2)
  else if (others.some((l) => l.campusId === form.campusId && same(l.name, name))) e.name = 'Điểm trường đã có phòng cùng tên';
  if (!form.type) e.type = 'Chọn loại phòng';
  if (form.type === 'CLASS' || (form.capacity !== '' && form.capacity != null)) {
    if (form.capacity === '' || form.capacity == null) e.capacity = 'Nhập sức chứa của phòng học';
    else if (!isInt(form.capacity, 1, Number.MAX_SAFE_INTEGER)) e.capacity = 'Sức chứa là số nguyên lớn hơn 0';
    else if (form.type === 'CLASS' && Number(form.capacity) < minCapacity)
      e.capacity = `Lớp đang dùng phòng có sĩ số tối đa ${minCapacity}, sức chứa không được nhỏ hơn`;
  }
  if ((form.note || '').length > 500) e.note = 'Ghi chú tối đa 500 ký tự';
  return e;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Staff account (PROPOSED): roles the Principal may give; Teacher and Kitchen staff need a campus. */
export const STAFF_ROLE_OPTIONS = ['VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF'];
export const validateStaffAccount = (form, others = []) => {
  const e = {};
  if (!form.fullName?.trim()) e.fullName = 'Nhập họ tên';
  else if (form.fullName.trim().length > 100) e.fullName = 'Họ tên tối đa 100 ký tự';
  const email = (form.email || '').trim().toLowerCase();
  if (!email) e.email = 'Nhập email';
  else if (!EMAIL.test(email)) e.email = 'Email không hợp lệ';
  else if (others.some((u) => (u.email || '').toLowerCase() === email)) e.email = 'Email đã được dùng cho tài khoản khác';
  if (form.phone && !PHONE.test(form.phone.trim())) e.phone = 'Số điện thoại chỉ gồm chữ số, dài 8–20 ký tự';
  if (!STAFF_ROLE_OPTIONS.includes(form.role)) e.role = 'Chọn vai trò';
  if (form.role !== 'VICE_PRINCIPAL' && !form.campusId) e.campusId = 'Chọn điểm trường';
  return e;
};

/** Hồ sơ nhân sự (PHT được sửa): họ tên, email, SĐT, ngày sinh, trình độ, ghi chú. */
export const validateStaffProfile = (form, others = []) => {
  const e = {};
  if (!form.fullName?.trim()) e.fullName = 'Nhập họ tên';
  else if (form.fullName.trim().length > 100) e.fullName = 'Họ tên tối đa 100 ký tự';
  const email = (form.email || '').trim().toLowerCase();
  if (!email) e.email = 'Nhập email';
  else if (!EMAIL.test(email)) e.email = 'Email không hợp lệ';
  else if (others.some((u) => (u.email || '').toLowerCase() === email)) e.email = 'Email đã được dùng cho tài khoản khác';
  if (form.phone && !PHONE.test(form.phone.trim())) e.phone = 'Số điện thoại chỉ gồm chữ số, dài 8–20 ký tự';
  if (form.dateOfBirth && !isIsoDate(form.dateOfBirth)) e.dateOfBirth = 'Ngày sinh không hợp lệ, nhập dạng dd/mm/yyyy';
  if ((form.qualification || '').length > 200) e.qualification = 'Trình độ tối đa 200 ký tự';
  if ((form.note || '').length > 500) e.note = 'Ghi chú tối đa 500 ký tự';
  return e;
};
