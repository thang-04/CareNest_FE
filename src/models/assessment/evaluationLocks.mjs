// Hạn, khóa, mở lại đánh giá cuối chủ đề / học kỳ / cuối năm theo lớp – kỳ (BE OBS-30)

export const EVALUATION_LOCK_KINDS = [
  { value: 'THEME', label: 'Đánh giá cuối chủ đề' },
  { value: 'SEMESTER', label: 'Đánh giá học kỳ' },
  { value: 'YEAR', label: 'Đánh giá cuối năm' },
];

export const EVALUATION_LOCK_KIND_LABELS = Object.fromEntries(EVALUATION_LOCK_KINDS.map((k) => [k.value, k.label]));

// Loại ở bảng "Lớp quá hạn" (BE trả WEEKLY cho nhận xét tuần)
export const OVERDUE_KIND_LABELS = { WEEKLY: 'Nhận xét tuần', ...EVALUATION_LOCK_KIND_LABELS };

/** Kỳ đã khóa và không đang mở lại của một loại: kỳ chọn được để mở lại. */
export const lockedPeriods = (periods = [], kind) => periods.filter((p) => p.kind === kind && p.locked && !p.unlockedUntil);

/** Kiểm nhập đủ; kỳ đã khóa, hạn hợp lệ do BE quyết định. */
export const reopenFormErrors = ({ classId, periodKey, validUntilOk, reason }, { hasLocked = true, reasonMax = 300 } = {}) => {
  const errs = {};
  if (!classId) errs.classId = 'Chọn lớp.';
  else if (!periodKey) errs.periodKey = hasLocked ? 'Chọn kỳ cần mở lại.' : 'Lớp chưa có kỳ nào đã khóa.';
  if (!validUntilOk) errs.validUntil = 'Chọn ngày giờ hết hạn.';
  const text = (reason || '').trim();
  if (!text) errs.reason = 'Nhập lý do mở lại.';
  else if (text.length > reasonMax) errs.reason = `Lý do tối đa ${reasonMax} ký tự.`;
  return errs;
};
