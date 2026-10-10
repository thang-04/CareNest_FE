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

export const DOMAINS = [
  'Phát triển thể chất',
  'Phát triển nhận thức',
  'Phát triển ngôn ngữ',
  'Phát triển tình cảm và kỹ năng xã hội',
  'Phát triển thẩm mỹ',
];

export const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6'];

export const EDU_STATUS = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PENDING_TL: 'PENDING_TL',
  PENDING_VP: 'PENDING_VP',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
};

export const EDU_STATUS_LABELS = {
  DRAFT: 'Nháp',
  SENT: 'Đã gửi tổ trưởng',
  PENDING_TL: 'Chờ tổ trưởng duyệt',
  PENDING_VP: 'Chờ Phó HT duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
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
export const domainLabel = (domain) => (domain === 'Phát triển thẩm mỹ' ? 'Phát triển thẩm mỹ (Nghệ thuật)' : domain);
/** 5 lĩnh vực của Chương trình GDMN được khoá cứng (chốt 10/10); lĩnh vực khác chỉ còn ở dữ liệu cũ. */
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
