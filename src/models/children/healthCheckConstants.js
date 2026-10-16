/**
 * Đợt khám sức khỏe theo điểm trường (user chốt 2026-10-15, PROPOSED — chờ BE ghi HLT-07).
 *
 * @typedef {Object} HealthCheckCampaign
 * @property {string} id
 * @property {string} name
 * @property {string} campusId
 * @property {string} campusName
 * @property {string} startDate          yyyy-mm-dd
 * @property {string} endDate            yyyy-mm-dd
 * @property {string} examiner           đơn vị khám / bác sĩ
 * @property {string} note
 * @property {CampaignStatus} status     computed by the service
 * @property {{ total: number, recorded: number, notRecorded: number, absent: number, watch: number, closeWatch: number }} progress
 * @property {number} waitingFollowUpCount   follow-ups of this campaign still waiting for parent contact
 * @property {{ at: string, userName: string, action: CampaignAction, reason?: string }[]} history
 *
 * @typedef {'UPCOMING'|'IN_PROGRESS'|'CLOSED'|'CANCELLED'} CampaignStatus
 * @typedef {'CREATED'|'UPDATED'|'CLOSED'|'REOPENED'|'CANCELLED'} CampaignAction
 * @typedef {'NOT_RECORDED'|'RECORDED'|'ABSENT'} ChildResultStatus
 */

export const CAMPAIGN_STATUS = { UPCOMING: 'UPCOMING', IN_PROGRESS: 'IN_PROGRESS', CLOSED: 'CLOSED', CANCELLED: 'CANCELLED' };

export const CAMPAIGN_STATUS_LABELS = {
  UPCOMING: 'Sắp diễn ra',
  IN_PROGRESS: 'Đang diễn ra',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã hủy',
};

export const CHILD_RESULT_STATUS = { NOT_RECORDED: 'NOT_RECORDED', RECORDED: 'RECORDED', ABSENT: 'ABSENT' };

export const CHILD_RESULT_STATUS_LABELS = { NOT_RECORDED: 'Chưa nhập', RECORDED: 'Đã nhập', ABSENT: 'Vắng khám' };

export const CAMPAIGN_ACTION_LABELS = {
  CREATED: 'Tạo đợt khám',
  UPDATED: 'Sửa thông tin đợt',
  CLOSED: 'Đóng đợt khám',
  REOPENED: 'Mở lại đợt khám',
  CANCELLED: 'Hủy đợt khám',
};

export const HEALTH_CHECK_FIELD_LIMITS = { name: 150, examiner: 150, note: 500, reason: 300 };

/**
 * Phiếu theo dõi sức khỏe: tự mở khi kết quả ở mức "Cần theo dõi sát" (user chốt 2026-10-15, PROPOSED — chờ BE ghi HLT-09).
 * Giáo viên phụ trách lớp cập nhật; Hiệu trưởng, Phó hiệu trưởng điểm trường chỉ xem. Hệ thống không chẩn đoán.
 *
 * @typedef {Object} HealthFollowUp
 * @property {string} id
 * @property {{ id: string, fullName: string, code: string, classId: string, className: string, campusName: string }} child
 * @property {FollowUpStatus} status
 * @property {string} openedAt
 * @property {{ on: string, note: string, byName: string, at: string }|null} contact
 * @property {{ on: string, note: string, byName: string, at: string }|null} externalResult
 * @property {string|null} closeReason
 * @property {boolean} canUpdate          computed by the service
 *
 * @typedef {'WAITING_PARENT_CONTACT'|'PARENT_CONTACTED'|'EXTERNAL_RESULT_RECORDED'|'CLOSED'} FollowUpStatus
 */
export const FOLLOW_UP_STATUS = {
  WAITING_PARENT_CONTACT: 'WAITING_PARENT_CONTACT',
  PARENT_CONTACTED: 'PARENT_CONTACTED',
  EXTERNAL_RESULT_RECORDED: 'EXTERNAL_RESULT_RECORDED',
  CLOSED: 'CLOSED',
};

export const FOLLOW_UP_STATUS_LABELS = {
  WAITING_PARENT_CONTACT: 'Chờ trao đổi phụ huynh',
  PARENT_CONTACTED: 'Đã trao đổi, đề nghị khám chuyên khoa',
  EXTERNAL_RESULT_RECORDED: 'Đã có kết quả khám bên ngoài',
  CLOSED: 'Đã đóng',
};

export const FOLLOW_UP_ACTION_LABELS = {
  OPENED: 'Mở phiếu (kết quả Cần theo dõi sát)',
  MEASUREMENT_ADDED: 'Thêm kết quả khám mới ở mức Cần theo dõi sát',
  PARENT_CONTACTED: 'Ghi trao đổi với phụ huynh',
  EXTERNAL_RESULT: 'Ghi kết quả khám bên ngoài',
  CLOSED: 'Đóng phiếu',
};

export const FOLLOW_UP_FIELD_LIMITS = { note: 500, reason: 300 };
