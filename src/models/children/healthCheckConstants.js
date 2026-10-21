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
 * @property {{ total: number, recorded: number, notRecorded: number, inProgress: number, notConcluded: number, absent: number,
 *   watch: number, closeWatch: number, byConclusion: { NORMAL: number, ISSUE: number, REFERRAL: number, TB_RISK: number } }} progress
 * @property {number} waitingFollowUpCount   follow-ups of this campaign still waiting for parent contact
 * @property {number} overdueFollowUpCount   among them, past the contact due date
 * @property {{ at: string, userName: string, action: CampaignAction, reason?: string }[]} history
 *
 * @typedef {'UPCOMING'|'IN_PROGRESS'|'CLOSED'|'CANCELLED'} CampaignStatus
 * @typedef {'CREATED'|'UPDATED'|'CLOSED'|'REOPENED'|'CANCELLED'} CampaignAction
 * @typedef {'NOT_RECORDED'|'IN_PROGRESS'|'RECORDED'|'ABSENT'|'NOT_CONCLUDED'} ChildResultStatus
 */

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

export const CAMPAIGN_ACTION_LABELS = {
  CREATED: 'Tạo đợt khám',
  UPDATED: 'Sửa thông tin đợt',
  CLOSED: 'Đóng đợt khám',
  REOPENED: 'Mở lại đợt khám',
  CANCELLED: 'Hủy đợt khám',
};

export const HEALTH_CHECK_FIELD_LIMITS = { name: 150, examiner: 150, note: 500, reason: 300 };

/**
 * Phiếu theo dõi sức khỏe dài hạn, mỗi trẻ tối đa 1 phiếu chưa đóng (user chốt 2026-10-15, 2026-10-16, PROPOSED — chờ BE ghi HLT-09).
 * Kết quả "Cần theo dõi sát" mới mở vòng theo dõi mới; trạng thái là tiến độ của vòng hiện tại.
 * Giáo viên phụ trách lớp cập nhật; Hiệu trưởng, Phó hiệu trưởng điểm trường chỉ xem. Hệ thống không chẩn đoán.
 *
 * @typedef {Object} HealthFollowUp
 * @property {string} id
 * @property {{ id: string, fullName: string, code: string, classId: string, className: string, campusName: string }} child
 * @property {FollowUpStatus} status
 * @property {string} openedAt
 * @property {{ startedAt: string, contactFrom: string, dueOn: string, contacted: boolean, overdueDays: number }|null} currentRound
 * @property {{ on: string, note: string, facility: string, nextVisitOn: string|null, byName: string }|null} latestExternalResult
 * @property {boolean} tbRisk             một kết quả trong phiếu có kết luận nguy cơ lao (tiền sử tiếp xúc)
 * @property {{ date: string, doctorName: string, issueText: string, action: string, adviceText: string, specialty: string }|null} referral
 *   kết luận bác sĩ của kết quả mới nhất trong phiếu (phiếu Phụ lục II)
 * @property {FollowUpEvent[]} timeline   chronological, only on the detail view
 * @property {string|null} closeReason
 * @property {FollowUpCloseOutcome|null} closeOutcome   null: đóng trước khi có kết quả đóng phiếu, hoặc đóng tự động
 * @property {string|null} closeConditionText            tên vấn đề khi đóng với KNOWN_CONDITION
 * @property {FollowUpCloseOutcome[]} closeOutcomeOptions kết quả chọn được khi đóng (BE tính theo phiếu)
 * @property {boolean} canUpdate          computed by the service
 * @property {boolean} canRecordExternal  the current round already has a parent contact
 *
 * @typedef {Object} FollowUpEvent
 * @property {FollowUpAction} action
 * @property {string} at
 * @property {string} userName           empty for system reminders
 * @property {string} [on]               contact date / external exam date
 * @property {string} [note]
 * @property {boolean} [atExam]          contact recorded automatically: the companion heard the doctor at the exam
 * @property {string} [facility]         external result: specialty / place
 * @property {string[]} [images]         external result: photos of the result paper (optional)
 * @property {string|null} [nextVisitOn] external result: next specialist visit
 * @property {boolean} [newRound]        a measurement that started a new round
 * @property {boolean} [newFinding]      MEASUREMENT_ADDED của mẫu FOLLOW_UP: false = lần khám không có bất thường mới, không mở vòng
 * @property {FollowUpCloseOutcome} [outcome]   CLOSED: kết quả đóng phiếu
 *
 * @typedef {'WAITING_PARENT_CONTACT'|'PARENT_CONTACTED'|'EXTERNAL_RESULT_RECORDED'|'CLOSED'} FollowUpStatus
 * @typedef {'OPENED'|'MEASUREMENT_ADDED'|'PARENT_CONTACTED'|'EXTERNAL_RESULT'|'OVERDUE_REMINDED'|'NEXT_VISIT_REMINDED'|'EXTERNAL_RESULT_REMINDED'|'CLOSED'} FollowUpAction
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
  OPENED: 'Mở phiếu: kết quả khám ở mức Cần theo dõi sát',
  MEASUREMENT_ADDED: 'Kết quả khám mới ở mức Cần theo dõi sát',
  PARENT_CONTACTED: 'Trao đổi với phụ huynh',
  EXTERNAL_RESULT: 'Kết quả khám bên ngoài',
  OVERDUE_REMINDED: 'Hệ thống nhắc: quá hạn trao đổi với phụ huynh',
  NEXT_VISIT_REMINDED: 'Hệ thống nhắc: tới ngày hẹn khám lại',
  EXTERNAL_RESULT_REMINDED: 'Hệ thống nhắc: chưa có kết quả khám chuyên khoa sau 30 ngày',
  CLOSED: 'Đóng phiếu',
};

// Lần khám của trẻ đang có phiếu mà không có bất thường mới: vào dòng thời gian, không mở vòng (user chốt 2026-10-21).
export const FOLLOW_UP_EXAM_NOTED_LABEL = 'Kết quả khám trong lúc đang theo dõi';

/**
 * Kết quả khi giáo viên đóng phiếu, theo lời bác sĩ (user chốt 2026-10-21). Trẻ còn cần khám, tái khám hay quan sát thì để phiếu mở.
 * @typedef {'DOCTOR_NORMAL'|'KNOWN_CONDITION'|'NO_SPECIALIST_RESULT'} FollowUpCloseOutcome
 */
export const FOLLOW_UP_CLOSE_OUTCOME = {
  DOCTOR_NORMAL: 'DOCTOR_NORMAL',
  KNOWN_CONDITION: 'KNOWN_CONDITION',
  NO_SPECIALIST_RESULT: 'NO_SPECIALIST_RESULT',
};

export const FOLLOW_UP_CLOSE_OUTCOME_LABELS = {
  DOCTOR_NORMAL: 'Bác sĩ kết luận bình thường (chuyên khoa hoặc bác sĩ trường)',
  KNOWN_CONDITION: 'Chuyên khoa xác định có vấn đề, đã có hướng điều trị',
  NO_SPECIALIST_RESULT: 'Không có kết quả chuyên khoa',
};

export const FOLLOW_UP_CLOSE_OUTCOME_HINTS = {
  DOCTOR_NORMAL: 'Trẻ sang mức Không ghi nhận bất thường.',
  KNOWN_CONDITION: 'Trẻ sang mức Vấn đề đã biết, ổn định. Tên vấn đề được ghi vào tiền sử bản thân của trẻ.',
  NO_SPECIALIST_RESULT: 'Ví dụ phụ huynh không đưa trẻ đi khám, mất liên lạc. Trẻ giữ mức của lần khám gần nhất tới đợt sau.',
};

export const FOLLOW_UP_FIELD_LIMITS = { note: 500, reason: 300, facility: 150, images: 3, condition: 100 };

/** Số ngày sau lần trao đổi mà chưa có kết quả khám chuyên khoa thì nhắc giáo viên (D16, user chốt 2026-10-17). */
export const EXTERNAL_RESULT_DUE_DAYS = 30;

/** Lý do không công bố được một kết quả (BE trả trong publishBlockedReason). */
export const PUBLISH_BLOCKED = { FOLLOW_UP_CONTACT_REQUIRED: 'FOLLOW_UP_CONTACT_REQUIRED' };

export const PUBLISH_BLOCKED_TEXT = {
  FOLLOW_UP_CONTACT_REQUIRED:
    'Kết quả ở mức Cần theo dõi sát chỉ công bố được sau khi bạn ghi trao đổi với phụ huynh trong phiếu theo dõi.',
};

// Tránh hiểu nhầm đóng phiếu là trẻ đã khỏe (user chốt 2026-10-16).
export const FOLLOW_UP_CLOSE_MEANING =
  'Đóng phiếu nghĩa là nhà trường đã xong việc theo dõi của phiếu này. Đóng phiếu không có nghĩa là sức khỏe của trẻ đã bình thường.';
