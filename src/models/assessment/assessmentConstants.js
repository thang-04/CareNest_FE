/**
 * Child assessment & rewards (SRS screens #52–#63, UC 4.1–4.8, 4.12, 4.13, BF-05, GBR-OBS / DEV / REW / AI).
 *
 * @typedef {Object} AssessmentCriterion   maintained by management (entity "Assessment Criterion")
 * @property {string} id
 * @property {string} name
 * @property {string} domain               one of DOMAINS (education-plan)
 * @property {string} description
 * @property {boolean} active
 *
 * @typedef {Object} DailyAssessment       one per child per timetable activity (GBR-OBS-01/02)
 * @property {string} id
 * @property {string} date                 yyyy-mm-dd
 * @property {string} classId
 * @property {string} campusId
 * @property {string} childId
 * @property {string} activity             timetable activity name
 * @property {string} healthStatus         HEALTH_STATUS
 * @property {string} emotion              EMOTION
 * @property {string[]} criteriaMet        criterion ids
 * @property {boolean} flag                daily flag awarded by the teacher (counts for tickets)
 * @property {string} comment
 * @property {string} recordedBy
 * @property {string} recordedAt
 * @property {string|null} updatedAt
 * @property {{ at: string, userId: string, reason: string }[]} corrections   edits after the lock (GBR-OBS-03)
 *
 * @typedef {Object} Evaluation            weekly / monthly (db.periodicEvaluations) or year-end (db.yearEndEvaluations)
 * @property {string} id
 * @property {'WEEK'|'MONTH'|'YEAR'} periodType
 * @property {string} periodStart
 * @property {string} periodEnd
 * @property {string} schoolYear
 * @property {string} childId
 * @property {string} classId
 * @property {string} campusId
 * @property {'AWAITING_REVIEW'|'AI_FAILED'|'CONFIRMED'} status
 * @property {{ content: string, generatedAt: string, source: Object }|null} aiDraft   stored apart from the final text (GBR-AI)
 * @property {string|null} aiError
 * @property {string} finalContent
 * @property {string|null} confirmedBy
 * @property {string|null} confirmedAt
 * @property {{ id: string, action: string, userId: string|null, at: string, note?: string }[]} history
 *
 * @typedef {Object} BehaviourTicket       one per child, ticket type and period
 * @property {string} id
 * @property {'WEEKLY'|'MONTHLY'} type
 * @property {string} periodStart
 * @property {string} periodEnd
 * @property {string} childId
 * @property {string} classId
 * @property {string} campusId
 * @property {string} issuedAt
 * @property {string} issuedBy
 *
 * @typedef {Object} RewardProposal        year-end reward: Teacher -> Vice Principal -> Principal (GBR-REW-03)
 * @property {string} id
 * @property {string} code
 * @property {string} schoolYear
 * @property {string} childId
 * @property {string} classId
 * @property {string} campusId
 * @property {string} rewardTitle
 * @property {string} reason
 * @property {string} status               REWARD_STATUS
 * @property {string} createdBy
 * @property {{ by: string, at: string, decision: string, comment: string }|null} vpReview
 * @property {{ by: string, at: string, decision: string, comment: string }|null} principalDecision
 * @property {{ id: string, action: string, userId: string, at: string, note?: string }[]} history
 */

export const HEALTH_STATUS = { GOOD: 'GOOD', TIRED: 'TIRED', UNWELL: 'UNWELL' };
export const HEALTH_STATUS_LABELS = { GOOD: 'Khỏe mạnh', TIRED: 'Hơi mệt', UNWELL: 'Không khỏe' };

// Plain observations only: no diagnostic wording (GBR-OBS-05).
export const EMOTION = { HAPPY: 'HAPPY', CALM: 'CALM', SAD: 'SAD', UPSET: 'UPSET' };
export const EMOTION_LABELS = { HAPPY: 'Vui vẻ', CALM: 'Bình thường', SAD: 'Buồn', UPSET: 'Quấy khóc' };

/** Attendance statuses as returned with the daily sheet (the attendance module owns them). */
export const ABSENCE_LABELS = { EXCUSED: 'Vắng có phép', UNEXCUSED: 'Vắng không phép' };

/** Default criteria (the backend owns the managed list). Domains match the education-plan DOMAINS. */
export const DEFAULT_CRITERIA = [
  {
    id: 'crit_tc_1',
    name: 'Tích cực vận động',
    domain: 'Phát triển thể chất',
    description: 'Tham gia đầy đủ các vận động trong hoạt động.',
  },
  { id: 'crit_tc_2', name: 'Tự phục vụ', domain: 'Phát triển thể chất', description: 'Tự cất dọn đồ dùng, tự vệ sinh cá nhân.' },
  {
    id: 'crit_nt_1',
    name: 'Tập trung chú ý',
    domain: 'Phát triển nhận thức',
    description: 'Chú ý lắng nghe, theo dõi hoạt động đến cuối.',
  },
  {
    id: 'crit_nt_2',
    name: 'Hoàn thành nhiệm vụ',
    domain: 'Phát triển nhận thức',
    description: 'Hoàn thành nhiệm vụ cô giao trong hoạt động.',
  },
  {
    id: 'crit_nn_1',
    name: 'Mạnh dạn phát biểu',
    domain: 'Phát triển ngôn ngữ',
    description: 'Giơ tay phát biểu, trả lời câu hỏi rõ ràng.',
  },
  {
    id: 'crit_tx_1',
    name: 'Hợp tác với bạn',
    domain: 'Phát triển tình cảm và kỹ năng xã hội',
    description: 'Chơi, làm việc cùng bạn, biết chờ đến lượt.',
  },
  {
    id: 'crit_tx_2',
    name: 'Lễ phép, chào hỏi',
    domain: 'Phát triển tình cảm và kỹ năng xã hội',
    description: 'Chào cô, chào bạn, biết cảm ơn và xin lỗi.',
  },
  { id: 'crit_tm_1', name: 'Hứng thú sáng tạo', domain: 'Phát triển thẩm mỹ', description: 'Hứng thú với hát, múa, vẽ, nặn, tạo hình.' },
].map((c) => ({ ...c, active: true }));

/** Timetable slots that are not assessed (arrival, meals and nap, going home). */
export const NON_ASSESSED_SLOT_KEYWORDS = ['Đón trẻ', 'Ăn', 'Trả trẻ'];

export const PERIOD_TYPE = { WEEK: 'WEEK', MONTH: 'MONTH', YEAR: 'YEAR' };
export const PERIOD_TYPE_LABELS = { WEEK: 'Tuần', MONTH: 'Tháng', YEAR: 'Cả năm học' };

export const EVAL_KIND = { PERIODIC: 'periodic', YEAR_END: 'year-end' };

export const EVAL_STATUS = { AWAITING_REVIEW: 'AWAITING_REVIEW', AI_FAILED: 'AI_FAILED', CONFIRMED: 'CONFIRMED' };
export const EVAL_STATUS_LABELS = {
  AWAITING_REVIEW: 'Chờ giáo viên duyệt',
  AI_FAILED: 'Chưa có bản nháp AI',
  CONFIRMED: 'Đã xác nhận',
};

export const AI_DRAFT_LABEL = 'Bản nháp AI – cần giáo viên duyệt';

export const EVAL_HISTORY_LABELS = {
  AI_DRAFTED: 'AI tạo bản nháp',
  AI_FAILED: 'AI không tạo được bản nháp',
  AI_REDRAFTED: 'Yêu cầu AI tạo lại bản nháp',
  EDITED: 'Giáo viên lưu chỉnh sửa',
  CONFIRMED: 'Giáo viên xác nhận và công bố',
};

export const TICKET_TYPE = { WEEKLY: 'WEEKLY', MONTHLY: 'MONTHLY' };
export const TICKET_TYPE_LABELS = { WEEKLY: 'Phiếu bé ngoan tuần', MONTHLY: 'Phiếu bé ngoan tháng' };

/** GBR-REW-01 / GBR-REW-02 thresholds. */
export const TICKET_RULES = { WEEK_MIN_PRESENT_DAYS: 4, WEEK_MIN_FLAGS: 3, MONTH_MIN_WEEKLY_TICKETS: 3 };

export const REWARD_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_VP: 'PENDING_VP',
  PENDING_PRINCIPAL: 'PENDING_PRINCIPAL',
  APPROVED: 'APPROVED',
  RETURNED: 'RETURNED',
  REJECTED: 'REJECTED',
};

export const REWARD_STATUS_LABELS = {
  DRAFT: 'Bản nháp',
  PENDING_VP: 'Chờ Phó hiệu trưởng xem xét',
  PENDING_PRINCIPAL: 'Chờ Hiệu trưởng phê duyệt',
  APPROVED: 'Đã phê duyệt',
  RETURNED: 'Bị trả lại',
  REJECTED: 'Bị từ chối',
};

export const REWARD_HISTORY_LABELS = {
  CREATED: 'Tạo bản nháp',
  UPDATED: 'Cập nhật đề xuất',
  SUBMITTED: 'Gửi đề xuất',
  RESUBMITTED: 'Gửi lại đề xuất',
  FORWARDED: 'Phó hiệu trưởng chuyển Hiệu trưởng',
  RETURNED: 'Phó hiệu trưởng trả lại',
  APPROVED: 'Hiệu trưởng phê duyệt',
  REJECTED: 'Hiệu trưởng từ chối',
};

/** Suggested reward titles (assumption: the SRS does not fix the list). */
export const REWARD_TITLES = [
  'Bé ngoan toàn diện',
  'Bé chăm ngoan, học giỏi',
  'Bé tích cực tham gia hoạt động',
  'Bé lễ phép, hòa đồng',
  'Bé có năng khiếu nghệ thuật',
  'Bé khỏe – Bé đẹp',
];

/** Words that must not appear in criteria or evaluations (GBR-OBS-05). Lower case, accents kept. */
export const DIAGNOSTIC_TERMS = [
  'tự kỷ',
  'tăng động',
  'giảm chú ý',
  'adhd',
  'chậm phát triển',
  'rối loạn',
  'khuyết tật',
  'trầm cảm',
  'thiểu năng',
  'chậm nói',
  'bệnh lý',
];
