/**
 * Đợt khám sức khỏe theo điểm trường (user chốt 2026-10-15, PROPOSED — chờ BE ghi HLT-07).
 * Kỳ cân đo dùng chung vòng đời của đợt, phân biệt bằng kind (user chốt 2026-10-31); đợt khám cũng là một kỳ cân đo.
 *
 * @typedef {Object} HealthCheckCampaign
 * @property {string} id
 * @property {CampaignKind} kind         dữ liệu cũ không có kind ⇒ EXAM
 * @property {string} name
 * @property {string} campusId
 * @property {string} campusName
 * @property {string} startDate          yyyy-mm-dd
 * @property {string} endDate            yyyy-mm-dd
 * @property {string} examiner           đơn vị khám / bác sĩ
 * @property {string} note
 * @property {CampaignStatus} status     computed by the service
 * @property {{ total: number, recorded: number, notRecorded: number, inProgress: number, notConcluded: number, absent: number,
 *   watch: number, closeWatch: number, bmi: { severeThinness: number, thinness: number, overweightRisk: number, overweight: number,
 *   obese: number } }} progress   watch/closeWatch theo kết luận bác sĩ (đợt khám); bmi: số trẻ theo mức BMI của kỳ cân đo (HLT-18)
 * @property {{ at: string, userName: string, action: CampaignAction, reason?: string }[]} history
 *
 * @typedef {'EXAM'|'MEASUREMENT'} CampaignKind
 * @typedef {'UPCOMING'|'IN_PROGRESS'|'CLOSED'|'CANCELLED'} CampaignStatus
 * @typedef {'CREATED'|'UPDATED'|'CLOSED'|'REOPENED'|'CANCELLED'} CampaignAction
 * @typedef {'NOT_RECORDED'|'IN_PROGRESS'|'RECORDED'|'ABSENT'|'NOT_CONCLUDED'} ChildResultStatus
 */

export const CAMPAIGN_KIND = { EXAM: 'EXAM', MEASUREMENT: 'MEASUREMENT' };

export const CAMPAIGN_KIND_LABELS = { EXAM: 'Đợt khám sức khỏe', MEASUREMENT: 'Kỳ cân đo' };

/** Cảnh báo khi tạo/sửa ngày bắt đầu (user chốt 2026-10-31): không chặn, người tạo xác nhận để lưu. */
export const SCHEDULE_WARNING = { TOO_CLOSE: 'TOO_CLOSE', EXAM_IN_SCHOOL_YEAR: 'EXAM_IN_SCHOOL_YEAR' };

/** Khoảng tối thiểu giữa ngày bắt đầu của hai kỳ/đợt cùng điểm trường (user chốt 2026-10-31). */
export const SCHEDULE_MIN_GAP = { months: 2, days: 15 };

export const CAMPAIGN_STATUS = { UPCOMING: 'UPCOMING', IN_PROGRESS: 'IN_PROGRESS', CLOSED: 'CLOSED', CANCELLED: 'CANCELLED' };

export const CAMPAIGN_STATUS_LABELS = {
  UPCOMING: 'Sắp diễn ra',
  IN_PROGRESS: 'Đang diễn ra',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã hủy',
};

// IN_PROGRESS: phiếu nháp; NOT_CONCLUDED: đợt đã đóng khi phiếu còn nháp (không tính vắng khám, user chốt 2026-10-17).
export const CHILD_RESULT_STATUS = {
  NOT_RECORDED: 'NOT_RECORDED',
  IN_PROGRESS: 'IN_PROGRESS',
  RECORDED: 'RECORDED',
  ABSENT: 'ABSENT',
  NOT_CONCLUDED: 'NOT_CONCLUDED',
};

export const CHILD_RESULT_STATUS_LABELS = {
  NOT_RECORDED: 'Chưa khám',
  IN_PROGRESS: 'Đang khám',
  RECORDED: 'Đã có kết luận',
  ABSENT: 'Vắng khám',
  NOT_CONCLUDED: 'Chưa kết luận',
};

// Kỳ cân đo không có phiếu nháp, kết luận (M6).
export const MEASUREMENT_RESULT_STATUS_LABELS = {
  NOT_RECORDED: 'Chưa cân đo',
  RECORDED: 'Đã cân đo',
  ABSENT: 'Vắng cân đo',
};

export const childResultLabelOf = (kind, status) =>
  (kind === CAMPAIGN_KIND.MEASUREMENT ? MEASUREMENT_RESULT_STATUS_LABELS : CHILD_RESULT_STATUS_LABELS)[status] || status;

export const CAMPAIGN_ACTION_LABELS = {
  CREATED: 'Tạo đợt khám',
  UPDATED: 'Sửa thông tin đợt',
  CLOSED: 'Đóng đợt khám',
  REOPENED: 'Mở lại đợt khám',
  CANCELLED: 'Hủy đợt khám',
};

export const MEASUREMENT_ROUND_ACTION_LABELS = {
  CREATED: 'Tạo kỳ cân đo',
  UPDATED: 'Sửa thông tin kỳ',
  CLOSED: 'Đóng kỳ cân đo',
  REOPENED: 'Mở lại kỳ cân đo',
  CANCELLED: 'Hủy kỳ cân đo',
};

export const campaignActionLabelOf = (kind, action) =>
  (kind === CAMPAIGN_KIND.MEASUREMENT ? MEASUREMENT_ROUND_ACTION_LABELS : CAMPAIGN_ACTION_LABELS)[action] || action;

export const HEALTH_CHECK_FIELD_LIMITS = { name: 150, examiner: 150, note: 500, reason: 300 };
