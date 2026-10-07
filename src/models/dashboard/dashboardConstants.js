/**
 * Dashboards (SRS screens #10–#14) and Pending Approval Requests (#126, UC 3.4).
 *
 * @typedef {Object} PendingApprovalItem  one row of #126, built from another module's record
 * @property {string} key        unique key (type + id)
 * @property {string} type       APPROVAL_TYPE
 * @property {string} id         id of the source record
 * @property {string} code       document code shown in bold
 * @property {string} title      what is waiting
 * @property {string} by         who sent it
 * @property {string|null} at    when it started waiting (ISO or 'yyyy-mm-dd HH:mm')
 * @property {string|null} campusId
 * @property {string} statusLabel
 * @property {string} to         detail / decision page of the owning module
 *
 * @typedef {Object} PendingApprovalGroup
 * @property {string} type
 * @property {PendingApprovalItem[]} items
 * @property {Error|null} error  a failing source never hides the other groups
 */

export const APPROVAL_TYPE = {
  LESSON_REVIEW: 'LESSON_REVIEW',
  THEME_PLAN: 'THEME_PLAN',
  LESSON_PLAN: 'LESSON_PLAN',
  REWARD_REVIEW: 'REWARD_REVIEW',
  REWARD_DECISION: 'REWARD_DECISION',
  FACILITY_ISSUE: 'FACILITY_ISSUE',
  FACILITY_REQUEST: 'FACILITY_REQUEST',
  FACILITY_PROPOSAL: 'FACILITY_PROPOSAL',
  INSPECTION: 'INSPECTION',
  MEAL_COUNT: 'MEAL_COUNT',
  STOCK_ISSUE: 'STOCK_ISSUE',
};

/** label: group title · tone: stat-card tone · listTo: the owning module's own list (link "Xem tất cả"). */
export const APPROVAL_TYPE_META = {
  LESSON_REVIEW: { label: 'Giáo án chờ tổ trưởng duyệt', short: 'Giáo án', tone: 'orange', listTo: '/education/reviews' },
  THEME_PLAN: { label: 'Kế hoạch chủ đề chờ duyệt', short: 'Kế hoạch chủ đề', tone: 'blue', listTo: '/education/approvals' },
  LESSON_PLAN: { label: 'Giáo án chờ Phó hiệu trưởng duyệt', short: 'Giáo án', tone: 'orange', listTo: '/education/approvals' },
  REWARD_REVIEW: { label: 'Đề xuất khen thưởng chờ xem xét', short: 'Khen thưởng', tone: 'green', listTo: '/assessment/rewards' },
  REWARD_DECISION: { label: 'Đề xuất khen thưởng chờ phê duyệt', short: 'Khen thưởng', tone: 'green', listTo: '/assessment/rewards' },
  FACILITY_ISSUE: { label: 'Báo cáo sự cố chờ duyệt', short: 'Sự cố CSVC', tone: 'red', listTo: '/facility/issues' },
  FACILITY_REQUEST: { label: 'Đề nghị bổ sung chờ duyệt', short: 'Đề nghị bổ sung', tone: 'purple', listTo: '/facility/requests' },
  FACILITY_PROPOSAL: {
    label: 'Đề xuất mua sắm, sửa chữa chờ phê duyệt',
    short: 'Đề xuất CSVC',
    tone: 'purple',
    listTo: '/facility/proposals',
  },
  INSPECTION: { label: 'Kiểm kê chờ duyệt', short: 'Kiểm kê', tone: 'blue', listTo: '/facility/inspections' },
  MEAL_COUNT: { label: 'Sĩ số suất ăn chờ xác nhận', short: 'Sĩ số suất ăn', tone: 'orange', listTo: '/attendance/meal-count' },
  STOCK_ISSUE: { label: 'Phiếu xuất kho thực phẩm chờ duyệt', short: 'Xuất kho', tone: 'orange', listTo: '/kitchen/stock-issues' },
};

/** Display order of the groups per role (SRS #126 lists plans, rewards and facility requests first). */
export const APPROVAL_TYPES_BY_ROLE = {
  PRINCIPAL: [APPROVAL_TYPE.REWARD_DECISION, APPROVAL_TYPE.FACILITY_PROPOSAL, APPROVAL_TYPE.FACILITY_REQUEST],
  VICE_PRINCIPAL: [
    APPROVAL_TYPE.THEME_PLAN,
    APPROVAL_TYPE.LESSON_PLAN,
    APPROVAL_TYPE.REWARD_REVIEW,
    APPROVAL_TYPE.FACILITY_ISSUE,
    APPROVAL_TYPE.FACILITY_REQUEST,
    APPROVAL_TYPE.INSPECTION,
    APPROVAL_TYPE.MEAL_COUNT,
    APPROVAL_TYPE.STOCK_ISSUE,
  ],
  TEAM_LEADER: [APPROVAL_TYPE.LESSON_REVIEW],
};
