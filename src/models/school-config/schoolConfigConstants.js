/**
 * School configuration (SRS 5.1 screens #16–#26, UC 2.1–2.7, GBR-CFG-01..03, GBR-GEN-03/06/10).
 *
 * @typedef {Object} SchoolYear
 * @property {string} id            same as name, e.g. '2026-2027' (used by the header year selector)
 * @property {string} name
 * @property {string} startDate     yyyy-mm-dd
 * @property {string} endDate       yyyy-mm-dd
 * @property {'PLANNED'|'ACTIVE'|'CLOSED'} status
 * @property {{ action: string, userId: string, at: string, note?: string }[]} history
 *
 * @typedef {Object} AgeGroupConfig
 * @property {string} id
 * @property {string} name
 * @property {string} shortName
 * @property {number} ageFromMonths   0–72, lower bound included
 * @property {number} ageToMonths     1–72, upper bound excluded (ranges of two groups do not overlap)
 * @property {string[]} mealSessions   meals served to the group (MORNING | LUNCH | AFTERNOON), set by the Principal
 * @property {number} mealsPerDay     = mealSessions.length (kept for modules that still read a number)
 * @property {number} maxClassSize    1–50, upper limit of the capacity of its classes
 * @property {string} nutritionNote
 * @property {{ action: string, userId: string, at: string, note?: string }[]} [history]
 *
 * @typedef {Object} CutoffSetting
 * @property {string} schoolYear
 * @property {string} time            'HH:mm', Asia/Ho_Chi_Minh
 * @property {string} effectiveFrom   yyyy-mm-dd
 * @property {string} updatedBy
 * @property {string} updatedAt
 * @property {{ time: string, effectiveFrom: string, previousTime: string|null, userId: string, at: string, note?: string }[]} history
 *
 * @typedef {Object} RolePermissionEntry
 * @property {string} role            one of CONFIG_ROLES
 * @property {Object<string, 'FULL'|'RESTRICTED'|'NONE'>} grants   permission code -> level
 * @property {{ userId: string, at: string, reason: string, changes: { code: string, from: string, to: string }[] }[]} history
 */

import { MEAL_SESSION_LABELS, SESSION_ORDER } from '@/models/menu-planning/menuPlanningConstants';

export const YEAR_STATUS = { PLANNED: 'PLANNED', ACTIVE: 'ACTIVE', CLOSED: 'CLOSED' };

export const YEAR_STATUS_LABELS = {
  PLANNED: 'Sắp diễn ra',
  ACTIVE: 'Đang hoạt động',
  CLOSED: 'Đã kết thúc',
};

/*
 * Chuyển năm học (PROPOSED 13/10/2026): Hiệu trưởng xếp lớp năm mới; kích hoạt khi đủ các bước bắt buộc
 * và từ 7 ngày trước ngày bắt đầu. BE phải kiểm tra lại cùng điều kiện.
 */
export const ACTIVATION_LEAD_DAYS = 7;

/** Result of a child in the new school year. */
export const PLACEMENT_ACTION = { PROMOTE: 'PROMOTE', STAY: 'STAY', LEAVE: 'LEAVE', GRADUATE: 'GRADUATE' };
export const PLACEMENT_ACTION_LABELS = {
  PROMOTE: 'Lên lớp',
  STAY: 'Ở lại nhóm tuổi',
  LEAVE: 'Nghỉ học / chuyển trường',
  GRADUATE: 'Ra trường',
};
/** Nhãn ngắn cho nút chọn trong hộp xếp lớp (nhãn đầy đủ ở PLACEMENT_ACTION_LABELS). */
export const PLACEMENT_ACTION_SHORT = { PROMOTE: 'Lên lớp', STAY: 'Ở lại', LEAVE: 'Nghỉ học', GRADUATE: 'Ra trường' };
/** Actions that put the child in a class of the new year. */
export const PLACEMENT_IN_CLASS = [PLACEMENT_ACTION.PROMOTE, PLACEMENT_ACTION.STAY];

/** Setup steps of a planned year, in order. `required` steps block activation. */
export const READINESS_STEPS = [
  { key: 'info', label: 'Thông tin năm học', required: true, to: (y) => `/school/years/${y}/edit`, action: 'Sửa' },
  { key: 'ageGroups', label: 'Nhóm tuổi & bữa ăn', required: true, to: (y) => `/school/classes?year=${y}`, action: 'Xem' },
  { key: 'classes', label: 'Lớp học', required: true, to: (y) => `/school/classes?year=${y}`, action: 'Thêm lớp' },
  { key: 'rooms', label: 'Phòng & sức chứa', required: true, to: (y) => `/school/classes?year=${y}`, action: 'Xếp phòng' },
  {
    key: 'vicePrincipals',
    label: 'Phó hiệu trưởng từng điểm trường',
    required: true,
    to: (y) => `/school/vice-principals?year=${y}`,
    action: 'Phân công',
  },
  {
    key: 'teamLeaders',
    label: 'Tổ trưởng nhóm tuổi',
    required: false,
    to: (y) => `/school/teachers?year=${y}`,
    action: 'Phân công',
  },
  {
    key: 'teachers',
    label: 'Giáo viên lớp',
    required: true,
    to: (y) => `/school/teachers?year=${y}`,
    action: 'Phân công',
  },
  { key: 'placement', label: 'Xếp lớp trẻ năm mới', required: true, to: (y) => `/school/placement?year=${y}`, action: 'Xếp lớp' },
  { key: 'cutoff', label: 'Giờ chốt điểm danh', required: true, to: (y) => `/school/cutoff?year=${y}`, action: 'Cài đặt' },
];

export const YEAR_ACTION_LABELS = {
  CREATED: 'Tạo năm học',
  UPDATED: 'Cập nhật thông tin',
  ACTIVATED: 'Kích hoạt năm học',
  CLOSED: 'Kết thúc năm học',
};

/*
 * Bữa ăn của nhóm tuổi: dùng lại đúng mã bữa của module thực đơn (MORNING, LUNCH, AFTERNOON) để không có danh mục thứ hai.
 * Điểm danh / suất ăn / bếp hiện chỉ có LUNCH, AFTERNOON (xem báo cáo, việc nối tiếp).
 */
export const MEAL_SESSION_OPTIONS = SESSION_ORDER;
export const MEAL_SESSION_SHORT = { MORNING: 'Phụ sáng', LUNCH: 'Trưa', AFTERNOON: 'Chiều (xế)' };
export { MEAL_SESSION_LABELS };
export const mealSessionsLabel = (g) =>
  (g?.mealSessions?.length ? SESSION_ORDER.filter((s) => g.mealSessions.includes(s)) : []).map((s) => MEAL_SESSION_SHORT[s]).join(' · ') ||
  '—';

export const ageRangeLabel = (g) => (g && g.ageFromMonths != null ? `${g.ageFromMonths}–${g.ageToMonths} tháng` : '—');

/** Class fill shown on Age Groups & Classes: NEAR from 90% of the max size. Each class has 2 teachers (SRS 4.1.3). */
export const CLASS_FILL = { OPEN: 'OPEN', NEAR: 'NEAR', FULL: 'FULL' };
export const CLASS_FILL_LABELS = { OPEN: 'Còn chỗ', NEAR: 'Gần đủ', FULL: 'Đã đủ' };
export const TEACHERS_PER_CLASS = 2;

/** Quick filters of the class list (URL ?status=). */
export const CLASS_FILTERS = {
  OPEN: 'Còn chỗ',
  NEAR: 'Gần đủ',
  FULL: 'Đã đủ',
  NO_TEACHER: 'Thiếu giáo viên',
  NO_ROOM: 'Chưa có phòng',
};

export const CLASS_STATUS_LABELS = { ACTIVE: 'Đang hoạt động', CLOSED: 'Đã đóng' };

/*
 * Mức quyền = quyền truy cập (Không có / Chỉ xem / Được sửa) × phạm vi (Toàn trường / Trong điểm trường).
 * Lưu một chuỗi để tương thích dữ liệu cũ: FULL = sửa toàn trường, RESTRICTED = sửa trong điểm trường (giá trị F / R của SRS 4.4),
 * VIEW_FULL / VIEW_RESTRICTED = chỉ xem (thêm 10/10/2026), NONE = không có.
 */
export const PERMISSION_LEVEL = {
  FULL: 'FULL',
  RESTRICTED: 'RESTRICTED',
  VIEW_FULL: 'VIEW_FULL',
  VIEW_RESTRICTED: 'VIEW_RESTRICTED',
  NONE: 'NONE',
};

export const PERMISSION_LEVEL_LABELS = {
  FULL: 'Sửa · toàn trường',
  RESTRICTED: 'Sửa · trong điểm trường',
  VIEW_FULL: 'Chỉ xem · toàn trường',
  VIEW_RESTRICTED: 'Chỉ xem · trong điểm trường',
  NONE: 'Không có',
};

export const PERMISSION_ACCESS = { NONE: 'NONE', VIEW: 'VIEW', EDIT: 'EDIT' };
export const PERMISSION_ACCESS_LABELS = { NONE: 'Không có', VIEW: 'Chỉ xem', EDIT: 'Được sửa' };
export const PERMISSION_SCOPE = { ALL: 'ALL', CAMPUS: 'CAMPUS' };
export const PERMISSION_SCOPE_LABELS = { ALL: 'Toàn trường', CAMPUS: 'Trong điểm trường' };

/** 'VIEW_RESTRICTED' -> { access: 'VIEW', scope: 'CAMPUS' } */
export const parseGrant = (level) => {
  if (!level || level === PERMISSION_LEVEL.NONE) return { access: PERMISSION_ACCESS.NONE, scope: PERMISSION_SCOPE.CAMPUS };
  const view = level.startsWith('VIEW_');
  return {
    access: view ? PERMISSION_ACCESS.VIEW : PERMISSION_ACCESS.EDIT,
    scope: level.endsWith('FULL') ? PERMISSION_SCOPE.ALL : PERMISSION_SCOPE.CAMPUS,
  };
};

/** { access, scope } -> stored level string */
export const composeGrant = ({ access, scope }) => {
  if (access === PERMISSION_ACCESS.NONE) return PERMISSION_LEVEL.NONE;
  const all = scope === PERMISSION_SCOPE.ALL;
  if (access === PERMISSION_ACCESS.VIEW) return all ? PERMISSION_LEVEL.VIEW_FULL : PERMISSION_LEVEL.VIEW_RESTRICTED;
  return all ? PERMISSION_LEVEL.FULL : PERMISSION_LEVEL.RESTRICTED;
};

/** Web roles of the SRS 4.4 Permission Matrix. Parents use the mobile app and are not configured here. */
export const CONFIG_ROLES = ['PRINCIPAL', 'VICE_PRINCIPAL', 'TEAM_LEADER', 'TEACHER', 'KITCHEN_STAFF'];

export const CONFIG_ROLE_LABELS = {
  PRINCIPAL: 'Hiệu trưởng',
  VICE_PRINCIPAL: 'Phó hiệu trưởng',
  TEACHER: 'Giáo viên',
  TEAM_LEADER: 'Tổ trưởng nhóm tuổi',
  KITCHEN_STAFF: 'Nhân viên bếp',
};

export const CONFIG_ROLE_DESCRIPTIONS = {
  PRINCIPAL: 'Quản lý toàn trường: cấu hình năm học, điểm trường, lớp, phân quyền Phó hiệu trưởng.',
  VICE_PRINCIPAL: 'Quản lý điểm trường được phân công: trẻ, bán trú, kế hoạch giáo dục, cơ sở vật chất.',
  TEACHER: 'Phụ trách lớp được phân công: điểm danh, sức khỏe, đánh giá, kế hoạch lớp.',
  TEAM_LEADER: 'Giáo viên điều phối nhóm tuổi: kế hoạch chủ đề, duyệt kế hoạch của giáo viên trong khối.',
  KITCHEN_STAFF: 'Nhân viên bếp của điểm trường: xem thực đơn, suất ăn, cập nhật trạng thái chế biến.',
};

/** Footnotes of the SRS matrix: what "Theo phạm vi" means for each role. */
export const ROLE_SCOPE_NOTES = {
  PRINCIPAL: 'Toàn trường (cả hai điểm trường).',
  VICE_PRINCIPAL: 'Chỉ trẻ, lớp, nhân sự và dữ liệu của điểm trường được phân công.',
  TEACHER: 'Chỉ trẻ và hồ sơ của lớp được phân công.',
  TEAM_LEADER: 'Chỉ lớp, giáo viên và kế hoạch của nhóm tuổi được phân công (và lớp mình dạy).',
  KITCHEN_STAFF: 'Chỉ bếp của điểm trường được phân công; số suất ăn chỉ được xem.',
};

export const PERMISSION_MODULES = {
  account: 'Tài khoản & phân quyền',
  schoolConfig: 'Cấu hình trường',
  children: 'Hồ sơ trẻ',
  attendance: 'Điểm danh & suất ăn',
  meal: 'Bán trú & thực đơn',
  health: 'Sức khỏe',
  assessment: 'Đánh giá & khen thưởng',
  education: 'Kế hoạch giáo dục',
  facility: 'Cơ sở vật chất',
  monitoring: 'Giám sát & phê duyệt',
};

export const SHARED_SERVICE_LABEL = 'Phụ trách dịch vụ chung (bán trú toàn trường)';

/*
 * Quyền riêng của từng Phó hiệu trưởng theo mảng phụ trách, gắn vào phân công năm học.
 * Mỗi mảng: phạm vi (1 điểm trường hoặc toàn trường) + các thao tác Xem · Thêm · Sửa · Xóa (người dùng chốt 13/10/2026).
 * actions: thao tác áp dụng cho mảng; actionHints: nghĩa của từng thao tác trong mảng.
 * linked: Thêm / Sửa / Xóa đi cùng nhau (thực đơn là dịch vụ chung 1 PHT phụ trách; CSVC làm sau); manageHint: câu mô tả gộp cho mảng linked.
 * scopes: phạm vi chọn được; menu là dữ liệu toàn trường, CSVC hiện chỉ hỗ trợ trong điểm trường.
 */
export const AREA_ACTIONS = ['view', 'create', 'update', 'delete'];
export const AREA_ACTION_LABELS = { view: 'Xem', create: 'Thêm', update: 'Sửa', delete: 'Xóa' };
const ACTION_CODE = { view: 'V', create: 'C', update: 'U', delete: 'D' };

export const VP_AREAS = [
  {
    key: 'menu',
    label: 'Thực đơn & dịch vụ bán trú',
    hint: 'Thực đơn tuần, món ăn, giá suất ăn, dịch vụ bán trú',
    scopes: ['ALL'],
    actions: AREA_ACTIONS,
    linked: true,
    manageHint: 'Lập, sửa, xóa thực đơn, món ăn, giá suất ăn',
  },
  {
    key: 'teacherAssignment',
    label: 'Phân công giáo viên',
    hint: 'Xếp giáo viên vào lớp, chọn chủ nhiệm',
    scopes: ['CAMPUS', 'ALL'],
    code: 'permission.assignTeacher',
    actions: ['view', 'create', 'update'],
    actionHints: { create: 'Phân công lớp chưa có giáo viên', update: 'Đổi giáo viên, chủ nhiệm' },
  },
  {
    // Tách khỏi "Phân công giáo viên" (người dùng chốt 14/10/2026): Hiệu trưởng mở cho PHT nào thì PHT đó phân công tổ trưởng.
    // Tổ trưởng là 1 người / nhóm tuổi cho cả trường nên phạm vi luôn là toàn trường.
    key: 'teamLeaders',
    label: 'Phân công tổ trưởng nhóm tuổi',
    hint: 'Chọn 1 tổ trưởng cho mỗi nhóm tuổi (toàn trường)',
    scopes: ['ALL'],
    actions: AREA_ACTIONS,
    actionHints: {
      create: 'Chọn tổ trưởng cho nhóm chưa có người',
      update: 'Đổi tổ trưởng',
      delete: 'Gỡ tổ trưởng nhóm tuổi',
    },
  },
  {
    key: 'facility',
    label: 'Cơ sở vật chất',
    hint: 'Sự cố, yêu cầu, đề xuất, luân chuyển, kiểm kê',
    scopes: ['CAMPUS'],
    actions: AREA_ACTIONS,
    linked: true,
    manageHint: 'Xử lý sự cố, yêu cầu, đề xuất, luân chuyển, kiểm kê',
  },
  {
    key: 'rooms',
    label: 'Quản lý phòng ban',
    hint: 'Phòng học và phòng chức năng',
    scopes: ['CAMPUS', 'ALL'],
    actions: AREA_ACTIONS,
    actionHints: { create: 'Thêm phòng', update: 'Sửa thông tin phòng', delete: 'Ngừng dùng, dùng lại, xóa phòng' },
  },
  {
    key: 'children',
    label: 'Hồ sơ trẻ',
    hint: 'Tiếp nhận, xếp lớp, sức khỏe, tài khoản phụ huynh',
    scopes: ['CAMPUS', 'ALL'],
    actions: ['view', 'create', 'update'],
    actionHints: { create: 'Tiếp nhận trẻ mới', update: 'Sửa hồ sơ, xếp lớp, khai báo sức khỏe, kích hoạt phụ huynh' },
  },
  {
    // Hiệu trưởng giao PHT xếp lớp năm học mới cho 1 điểm trường hoặc toàn trường (Cần đề xuất 20/10/2026, PROPOSED)
    key: 'yearPlacement',
    label: 'Xếp lớp năm học mới',
    hint: 'Chuyển trẻ lên lớp của năm học sắp diễn ra: tự xếp, xếp tay, ở lại, ra trường',
    scopes: ['CAMPUS', 'ALL'],
    actions: ['view', 'update'],
    actionHints: { update: 'Tự xếp, xếp tay, đổi kết quả xếp lớp' },
  },
  {
    key: 'staff',
    label: 'Hồ sơ nhân sự',
    hint: 'Giáo viên, tổ trưởng, nhân viên bếp; tạo, khóa tài khoản do Hiệu trưởng',
    scopes: ['CAMPUS', 'ALL'],
    actions: ['view', 'update'],
    actionHints: { update: 'Sửa thông tin hồ sơ (họ tên, liên hệ, ngày sinh, trình độ)' },
  },
];

/** Default areas of an assignment (same behaviour as before the per-person rights). */
export const defaultVpAreas = (assignment, roleGrants = {}) => ({
  menu: assignment?.sharedService ? PERMISSION_LEVEL.FULL : PERMISSION_LEVEL.VIEW_FULL,
  teacherAssignment: roleGrants['permission.assignTeacher'] || PERMISSION_LEVEL.RESTRICTED,
  teamLeaders: PERMISSION_LEVEL.NONE,
  facility: PERMISSION_LEVEL.RESTRICTED,
  rooms: PERMISSION_LEVEL.VIEW_RESTRICTED,
  children: PERMISSION_LEVEL.RESTRICTED,
  yearPlacement: PERMISSION_LEVEL.NONE,
  staff: PERMISSION_LEVEL.VIEW_RESTRICTED,
});

/*
 * Lưu dạng "<thao tác>@<điểm trường | ALL>", vd "VCU@c1" (Xem, Thêm, Sửa ở Campus 1), "V@ALL".
 * Dữ liệu cũ vẫn đọc được: "EDIT@c1" = Xem + Thêm + Sửa + Xóa, "VIEW@c1" = Xem; FULL, RESTRICTED… tính theo điểm trường của PHT.
 */
export const AREA_SCOPE_ALL = 'ALL';
const NO_ACTIONS = { view: false, create: false, update: false, delete: false };
const ALL_ACTIONS = { view: true, create: true, update: true, delete: true };
const accessOf = (actions) =>
  actions.create || actions.update || actions.delete
    ? PERMISSION_ACCESS.EDIT
    : actions.view
      ? PERMISSION_ACCESS.VIEW
      : PERMISSION_ACCESS.NONE;
const actionsOfAccess = (access) =>
  access === PERMISSION_ACCESS.EDIT ? ALL_ACTIONS : access === PERMISSION_ACCESS.VIEW ? { ...NO_ACTIONS, view: true } : NO_ACTIONS;

/** { actions | access, campusId } -> "VCU@c1"; không có thao tác nào = NONE. */
export const composeAreaGrant = ({ actions, access, campusId }) => {
  const a = actions || actionsOfAccess(access);
  const code = AREA_ACTIONS.filter((k) => a[k])
    .map((k) => ACTION_CODE[k])
    .join('');
  if (!code) return PERMISSION_LEVEL.NONE;
  // Có Thêm / Sửa / Xóa thì luôn kèm Xem
  return `${code.startsWith('V') ? code : `V${code}`}@${campusId || AREA_SCOPE_ALL}`;
};

/** -> { access, actions, scope: ALL | CAMPUS, campusId } ; campusId = điểm trường được giao (null khi toàn trường). */
export const parseAreaGrant = (value, ownCampusId) => {
  if (value && value.includes('@')) {
    const [code, target] = value.split('@');
    const all = target === AREA_SCOPE_ALL;
    let actions;
    if (code === PERMISSION_ACCESS.EDIT || code === PERMISSION_ACCESS.VIEW) actions = actionsOfAccess(code);
    else actions = Object.fromEntries(AREA_ACTIONS.map((k) => [k, code.includes(ACTION_CODE[k])]));
    if (actions.create || actions.update || actions.delete) actions.view = true;
    return {
      access: accessOf(actions),
      actions,
      scope: all ? PERMISSION_SCOPE.ALL : PERMISSION_SCOPE.CAMPUS,
      campusId: all ? null : target,
    };
  }
  const g = parseGrant(value);
  return { ...g, actions: actionsOfAccess(g.access), campusId: g.scope === PERMISSION_SCOPE.ALL ? null : ownCampusId || null };
};

/** Mảng có Thêm / Sửa / Xóa nào không (dùng cho quy tắc 1 PHT sửa thực đơn). */
export const grantWrites = (value, ownCampusId) => parseAreaGrant(value, ownCampusId).access === PERMISSION_ACCESS.EDIT;

/** "Xem, Thêm, Sửa" */
export const actionsText = (actions) =>
  AREA_ACTIONS.filter((k) => actions?.[k])
    .map((k) => AREA_ACTION_LABELS[k])
    .join(', ');

/** Areas of an assignment. New format (areasV2): only the added areas, others NONE. Old data: saved values over the defaults. */
export const vpAreasOf = (assignment, roleGrants) => {
  if (assignment?.areasV2) return Object.fromEntries(VP_AREAS.map((a) => [a.key, assignment.areas?.[a.key] || PERMISSION_LEVEL.NONE]));
  return { ...defaultVpAreas(assignment, roleGrants), ...(assignment?.areas || {}) };
};

/** Old format -> new format relative to the VP's campus (migration of demo data). */
export const toAreasV2 = (assignment, roleGrants) =>
  Object.fromEntries(
    Object.entries(vpAreasOf(assignment, roleGrants))
      .map(([key, value]) => [key, parseAreaGrant(value, assignment?.campusId)])
      .filter(([, g]) => g.access !== PERMISSION_ACCESS.NONE)
      .map(([key, g]) => [key, composeAreaGrant(g)]),
  );

export const CUTOFF_DEFAULT_HINT = 'Giờ Việt Nam (Asia/Ho_Chi_Minh). Sau giờ này, điểm danh và đăng ký suất ăn trong ngày bị khóa.';
