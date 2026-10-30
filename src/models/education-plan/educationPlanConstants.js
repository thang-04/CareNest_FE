/*
 * Education plan (kế hoạch giáo dục): yearly goals -> theme plans -> weekly / daily lesson plans.
 * Constants and pure helpers shared by pages, the mock repository and the seed.
 */

/** Goals and theme plans apply to the whole school (both campuses). */
export const SCHOOL_SCOPE = 'Toàn trường';

/** School year label used inside this module ('2026 – 2027'); the header stores ids ('2026-2027'). */
export const toEduYear = (id) => (id ? id.replace('-', ' – ') : id);
export const fromEduYear = (label) => (label ? label.replace(' – ', '-') : label);

export const AGE_GROUPS = [
  { id: 'ag-2', name: 'Nhà trẻ (24–36 tháng)' },
  { id: 'ag-3', name: 'Mẫu giáo bé (3–4 tuổi)' },
  { id: 'ag-4', name: 'Mẫu giáo nhỡ (4–5 tuổi)' },
  { id: 'ag-5', name: 'Mẫu giáo lớn (5–6 tuổi)' },
];

export const CLASSES = [
  { id: 'c-choi1', name: 'Chồi 1', room: 'Phòng 201', ageGroupId: 'ag-4' },
  { id: 'c-choi2', name: 'Chồi 2', room: 'Phòng 202', ageGroupId: 'ag-4' },
];

/** 5 lĩnh vực theo Chương trình Giáo dục mầm non hiện hành. */
export const STANDARD_DOMAINS = [
  'Phát triển thể chất',
  'Phát triển nhận thức',
  'Phát triển ngôn ngữ',
  'Phát triển tình cảm và kỹ năng xã hội',
  'Phát triển thẩm mỹ',
];

/**
 * Lĩnh vực đang dùng = 5 lĩnh vực chuẩn + lĩnh vực trường thêm ở trang Cấu hình (khi Bộ bổ sung).
 * Một danh sách dùng chung: cấu hình nạp xong thì cập nhật tại chỗ để mọi bảng, file xuất đọc cùng thứ tự.
 */
export const DOMAINS = [...STANDARD_DOMAINS];
export const setDomains = (names) => {
  DOMAINS.splice(0, DOMAINS.length, ...names);
};

export const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

export const EDU_STATUS = {
  DRAFT: 'DRAFT',
  EDITING: 'EDITING',
  SENT: 'SENT',
  PENDING_TL: 'PENDING_TL',
  PENDING_VP: 'PENDING_VP',
  PENDING_HT: 'PENDING_HT',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

export const EDU_STATUS_LABELS = {
  DRAFT: 'Nháp',
  EDITING: 'Đang sửa',
  SENT: 'Đã gửi tổ trưởng',
  PENDING_TL: 'Chờ tổ trưởng duyệt',
  PENDING_VP: 'Chờ Phó HT duyệt',
  PENDING_HT: 'Chờ Hiệu trưởng duyệt',
  APPROVED: 'Đã duyệt',
  // Tên trạng thái theo nghiệp vụ (BE:EDU-05, EDU-18): trả lại để sửa, không phải từ chối hẳn
  REJECTED: 'Bị trả lại',
};

export function allGoalItems(goal) {
  if (!goal) return [];
  return goal.domains.flatMap((d) => d.items.map((it) => ({ ...it, domain: d.name })));
}

// Cấu trúc kế hoạch chủ đề / tuần / ngày theo mẫu giáo án thật của MN Yên Định (knowledge/giao_an_mn_yen_dinh).
// Ba cấp nối với nhau bằng mã yêu cầu cần đạt (YCCĐ) dạng TC1.1: tiền tố lĩnh vực + số mục tiêu năm học trong lĩnh vực + số thứ tự.

export const DOMAIN_PREFIX = {
  'Phát triển thể chất': 'TC',
  'Phát triển tình cảm và kỹ năng xã hội': 'TX',
  'Phát triển ngôn ngữ': 'NN',
  'Phát triển nhận thức': 'NT',
  'Phát triển thẩm mỹ': 'NgT',
};
export const DOMAIN_SHORT = {
  'Phát triển thể chất': 'Thể chất',
  'Phát triển tình cảm và kỹ năng xã hội': 'Tình cảm – xã hội',
  'Phát triển ngôn ngữ': 'Ngôn ngữ',
  'Phát triển nhận thức': 'Nhận thức',
  'Phát triển thẩm mỹ': 'Thẩm mỹ (Nghệ thuật)',
};
/** Tên hiển thị đầy đủ: lĩnh vực thẩm mỹ được giáo án thật gọi là "Nghệ thuật" (mã NgT). */
// Tên hiển thị của lĩnh vực theo cấu hình của trường (trang Cấu hình kế hoạch giáo dục); mặc định là tên theo Chương trình
let domainLabelOverrides = { 'Phát triển thẩm mỹ': 'Phát triển thẩm mỹ (Nghệ thuật)' };
export const setDomainLabelOverrides = (map) => {
  domainLabelOverrides = map || {};
};
export const domainLabel = (domain) => domainLabelOverrides[domain] || domain;
/** Lĩnh vực đang dùng (chuẩn hoặc trường đã thêm); lĩnh vực khác chỉ còn ở dữ liệu cũ. */
export const isStandardDomain = (domain) => DOMAINS.includes(domain);
export const prefixOf = (domain) =>
  DOMAIN_PREFIX[domain] ||
  (domain || 'MT')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase();

/** Giờ sinh hoạt trong ngày theo nhóm tuổi (nhà trẻ và mẫu giáo gọi khác nhau) */
const SLOTS_MG = [
  { name: 'Đón trẻ – Trò chuyện sáng', duration: '' },
  { name: 'Thể dục sáng', duration: '15–20 phút', allWeek: true },
  { name: 'Hoạt động học', duration: '25–30 phút' },
  { name: 'Hoạt động ngoài trời', duration: '40–45 phút' },
  { name: 'Hoạt động vui chơi trong lớp', duration: '35–40 phút' },
  { name: 'Ăn – Ngủ – Vệ sinh', duration: '', allWeek: true },
  { name: 'Sinh hoạt chiều', duration: '' },
  { name: 'Trả trẻ', duration: '', allWeek: true },
];
const SLOTS_NT = [
  { name: 'Đón trẻ – Chơi', duration: '' },
  { name: 'Thể dục sáng', duration: '10–15 phút', allWeek: true },
  { name: 'Hoạt động học', duration: '15–20 phút' },
  { name: 'Chơi ngoài trời', duration: '30 phút' },
  { name: 'Chơi trong lớp', duration: '30 phút' },
  { name: 'Ăn – Ngủ – Vệ sinh', duration: '', allWeek: true },
  { name: 'Chơi – tập buổi chiều', duration: '' },
  { name: 'Trả trẻ', duration: '', allWeek: true },
];
export const slotsFor = (ageGroupId) => (ageGroupId === 'ag-2' ? SLOTS_NT : SLOTS_MG);

export const QUALITIES = ['Yêu thương', 'Tôn trọng', 'Trách nhiệm', 'Trung thực'];
export const COMPETENCIES = ['Giao tiếp', 'Hợp tác', 'Giải quyết vấn đề', 'Tự lực', 'Thích ứng'];
export const STEP_TEMPLATE = [
  'Gây hứng thú – Kết nối',
  'Quan sát – Trải nghiệm',
  'Chia sẻ',
  'Vận dụng – Luyện tập',
  'Khái quát – Đánh giá',
];

/** YCCĐ có mã cố định của mục tiêu năm học (Phó HT lập, dùng cả năm; kế hoạch chủ đề chỉ chọn từ đây). */
export function goalRequirements(goal) {
  return allGoalItems(goal).flatMap((it) =>
    (it.requirements || []).map((r) => ({ ...r, goalCode: it.code, goalText: it.text, domain: it.domain })),
  );
}

/** Mã gợi ý cho YCCĐ mới: tiền tố lĩnh vực + vị trí mục tiêu trong lĩnh vực + số thứ tự (ví dụ TC1.2). */
export function suggestRequirementCode(domain, goalIndex, requirements = []) {
  const base = `${prefixOf(domain)}${goalIndex + 1}.`;
  const used = requirements.filter((r) => (r.code || '').startsWith(base)).map((r) => Number(r.code.slice(base.length)) || 0);
  return `${base}${(used.length ? Math.max(...used) : 0) + 1}`;
}

/** Danh sách mã YCCĐ của một kế hoạch chủ đề (dùng để gắn vào kế hoạch tuần / ngày) */
export const themeCodes = (theme) =>
  (theme?.rows || []).map((r) => ({ code: r.code, text: r.requirement, domain: r.domain, goalCode: r.goalCode }));

/** Mã lỗi nghiệp vụ BE dùng ở module (BE:src/main/java/com/carenest/utils/ApiCode.java); phân biệt lỗi bằng mã, không so câu. */
export const EDU_ERROR_CODE = {
  REQUIRED_FIELD_MISSING: 9003,
  INVALID_VALUE: 9007,
  CLASS_ACCESS_DENIED: 2201,
  YEAR_PLAN_NOT_FOUND: 7001,
  YEAR_PLAN_EDIT_FORBIDDEN: 7005,
  YEAR_PLAN_LOCKED_BY_OTHER: 7006,
  YEAR_PLAN_INVALID_STATUS: 7009,
  RETURN_REASON_REQUIRED: 7010,
  THEME_ABBR_DUPLICATE: 7012,
  YEAR_PLAN_DELETE_DRAFT_ONLY: 7018,
  CURRICULUM_GOAL_INVALID: 7030,
  EDIT_SESSION_LOST: 7020,
  YEAR_PLAN_REVISION_STALE: 7021,
  CLASS_DOC_NOT_FOUND: 7101,
  CLASS_DOC_TEACHER_ONLY: 7103,
  CLASS_DOC_SUBMITTED: 7106,
  WEEKLY_LESSON_VIA_THEME: 7107,
  BRANCH_WEEKS_UNNAMED: 7112,
  NOT_YOUR_REVIEW_STEP: 7114,
  THEME_PLAN_NOT_FOUND: 7115,
  CLASS_DOC_LOCKED: 7117,
  LEARNING_RESOURCE_NOT_FOUND: 7118,
  ACTIVITY_CHANGED: 7120,
  YEAR_PLAN_VERSION_SOURCE_INVALID: 7027,
  YEAR_PLAN_OPEN_VERSION_EXISTS: 7028,
  CLASS_DOC_VERSION_FIX_REQUIRED: 7121,
  YEAR_PLAN_SUPERSEDED: 7122,
  CLASS_DOC_ADJUSTMENT_INVALID: 7123,
  EDU_CONFIG_FORBIDDEN: 7201,
  YEAR_PLAN_SIGNER_REQUIRED: 7203,
  CLASS_DOC_APPROVER_REQUIRED: 7204,
  LESSON_ROW_REQUIRED: 7206,
  DOMAIN_NAME_EXISTS: 7207,
  UNSUPPORTED_MEDIA_TYPE: 8004,
  FILE_TOO_LARGE: 8005,
  FILE_EMPTY: 8012,
};
