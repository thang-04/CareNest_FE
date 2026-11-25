/*
 * Danh sách gọn tài liệu lớp (edu-list-paging, Tiền 25/11/2026): cùng danh sách trường như BE
 * EduClassDocServiceImpl.SUMMARY_FIELDS — chỉ nhận diện, trạng thái, hạn, quyền; lịch sử giữ 5 mục cuối.
 */
const SUMMARY_FIELDS = [
  'id',
  'kind',
  'classId',
  'yearPlanId',
  'themeId',
  'themeIds',
  'semesterNo',
  'weekStart',
  'date',
  'status',
  'waitingRole',
  'version',
  'dossierVersion',
  'yearPlanVersion',
  'superseded',
  'returned',
  'unreleased',
  'canRevise',
  'containerKey',
  'containerStatus',
  'deadline',
  'reviewDeadline',
  'extendedTo',
  'blockedReason',
  'completedAt',
  'review',
  'approvals',
  'permissions',
];

export const classDocSummary = (doc) => {
  const out = Object.fromEntries(SUMMARY_FIELDS.filter((key) => key in doc).map((key) => [key, doc[key]]));
  if (Array.isArray(doc.history)) out.history = doc.history.slice(-5);
  return out;
};

/**
 * Trang `page` (bắt đầu 0, cỡ `size`) của danh sách ghép: `head` (bản ghi đã có đủ, vd. kế hoạch năm/tổ chờ duyệt) đứng
 * trước rồi tới tài liệu lớp phân trang ở BE. Trả { headItems, docRequests: [{ page, from, to }] } để lấy đúng lát cần.
 */
export const mixedPage = (headCount, page, size = 5) => {
  const start = page * size;
  const end = start + size;
  const headItems = [Math.min(start, headCount), Math.min(end, headCount)];
  const from = Math.max(0, start - headCount);
  const to = Math.max(0, end - headCount);
  if (to <= from) return { headItems, docRequests: [] };
  const first = Math.floor(from / size);
  const last = Math.floor((to - 1) / size);
  const docRequests = [];
  for (let p = first; p <= last; p += 1)
    docRequests.push({ page: p, from: Math.max(from - p * size, 0), to: Math.min(to - p * size, size) });
  return { headItems, docRequests };
};
