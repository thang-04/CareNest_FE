/*
 * Shared validation of the school-config module (UI + mock server).
 * Each function returns { field: message }; `others` are the existing records used for duplicate checks.
 * Rules: Academic Year / Class / Campus entities (SRS 3.2), UC 2.1–2.7, GBR-CFG-02, MSG19/MSG20.
 */
import { normalizeText } from '@/utils/format';

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
  if (!form.endDate) e.endDate = 'Chọn ngày kết thúc';
  else if (form.startDate && form.endDate <= form.startDate) e.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
  if (!e.startDate && !e.endDate) {
    const overlap = others.find((y) => form.startDate <= y.endDate && y.startDate <= form.endDate);
    if (overlap) e.endDate = `Khoảng thời gian trùng với năm học ${overlap.name} (${overlap.startDate} – ${overlap.endDate})`;
  }
  return e;
};

export const validateAgeGroup = (form, others = []) => {
  const e = {};
  if (!form.name?.trim()) e.name = 'Nhập tên nhóm tuổi';
  else if (others.some((g) => same(g.name, form.name))) e.name = 'Tên nhóm tuổi đã tồn tại';
  if (!form.shortName?.trim()) e.shortName = 'Nhập tên ngắn';
  if (!form.ageRange?.trim()) e.ageRange = 'Nhập độ tuổi, ví dụ 3–4 tuổi';
  const meals = Number(form.mealsPerDay);
  if (!Number.isInteger(meals) || meals < 1 || meals > 5) e.mealsPerDay = 'Số bữa mỗi ngày từ 1 đến 5';
  return e;
};

/** Class names are unique within one school year and campus (see report: SRS says per year). */
export const validateClass = (form, others = []) => {
  const e = {};
  if (!form.name?.trim()) e.name = 'Nhập tên lớp';
  else if (others.some((c) => c.schoolYear === form.schoolYear && c.campusId === form.campusId && same(c.name, form.name)))
    e.name = 'Điểm trường đã có lớp cùng tên trong năm học này';
  if (!form.campusId) e.campusId = 'Chọn điểm trường';
  if (!form.ageGroupId) e.ageGroupId = 'Chọn nhóm tuổi';
  if (!form.schoolYear) e.schoolYear = 'Chọn năm học';
  const cap = Number(form.capacity);
  if (!Number.isInteger(cap) || cap < 1 || cap > 60) e.capacity = 'Sĩ số tối đa từ 1 đến 60 trẻ';
  return e;
};

export const validateCutoff = (form, year) => {
  const e = {};
  if (!form.time) e.time = 'Nhập giờ chốt';
  else if (!TIME.test(form.time)) e.time = 'Nhập giờ hợp lệ dạng HH:mm, ví dụ 08:45';
  if (!form.effectiveFrom) e.effectiveFrom = 'Chọn ngày áp dụng';
  else if (year && (form.effectiveFrom < year.startDate || form.effectiveFrom > year.endDate))
    e.effectiveFrom = `Ngày áp dụng phải nằm trong năm học ${year.name}`;
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

export const validateClassTeachers = (form) => {
  const e = {};
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
