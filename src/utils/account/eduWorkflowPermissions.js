import { ROLES } from '@/models/User';

/*
 * Tab Soạn / duyệt hồ sơ (BE EDU-108, EDU-54). Contract: BE GET/PUT /permissions/edu-workflow.
 * Ô tích = mã soạn/duyệt của vai trò; HT là vai trò cố định nên luôn có mã. Người soạn và thứ tự duyệt chọn trong
 * các vai trò đã tích. Ràng buộc ở đây chỉ để báo sớm, BE kiểm lại (SIGNERS_INVALID).
 */
export const EDU_WORKFLOW_COLUMNS = [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.TEAM_LEADER, ROLES.TEACHER];

export const EDU_DOC_LABELS = {
  SCHOOL_YEAR: 'Kế hoạch năm học',
  TEAM: 'Kế hoạch tổ',
  SEMESTER_PACKAGE: 'Gói học kỳ',
  THEME_PLAN: 'Hồ sơ chủ đề',
};

// GV không có mã duyệt (BE Permission.configurableRoles)
export const canTick = (row, role) => role !== ROLES.PRINCIPAL && !(row === 'approve' && role === ROLES.TEACHER);

const field = (row) => (row === 'edit' ? 'editRoles' : 'approveRoles');

/** Tích/bỏ tích một ô; bỏ tích thì vai trò đó rời khỏi người soạn hoặc chuỗi duyệt. */
export function toggleCell(doc, row, role, on) {
  if (!canTick(row, role)) return doc;
  const key = field(row);
  const roles = on ? [...new Set([...doc[key], role])] : doc[key].filter((r) => r !== role);
  const next = { ...doc, [key]: roles };
  if (!on && row === 'edit') next.creators = doc.creators.filter((r) => r !== role);
  if (!on && row === 'approve') next.reviewers = doc.reviewers.filter((r) => r !== role);
  return next;
}

/** Vai trò chọn được làm người soạn / thêm vào chuỗi duyệt. */
export const creatorOptions = (doc) => EDU_WORKFLOW_COLUMNS.filter((r) => doc.editRoles.includes(r) && !doc.reviewers.includes(r));
export const reviewerOptions = (doc) =>
  EDU_WORKFLOW_COLUMNS.filter((r) => doc.approveRoles.includes(r) && !doc.reviewers.includes(r) && !doc.creators.includes(r));

/** Lỗi theo docType; rỗng ⇒ gửi được. */
export function validateEduWorkflow(docs) {
  const errors = {};
  docs.forEach((doc) => {
    let message = null;
    if (doc.creators.length !== 1) message = 'Chọn đúng một vai trò soạn.';
    else if (doc.reviewers.length === 0) message = 'Chuỗi duyệt cần ít nhất một vai trò.';
    else if (doc.creators.some((r) => doc.reviewers.includes(r))) message = 'Vai trò soạn không được trùng vai trò duyệt.';
    else if (doc.creators.some((r) => !doc.editRoles.includes(r))) message = 'Vai trò soạn phải có mã soạn.';
    else if (doc.reviewers.some((r) => !doc.approveRoles.includes(r))) message = 'Vai trò duyệt phải có mã duyệt.';
    if (message) errors[doc.docType] = message;
  });
  return errors;
}

/** Thân PUT: bỏ trường chỉ để đọc. */
export const toEduWorkflowRequest = (revision, docs, reason) => ({
  revision,
  reason,
  documents: docs.map(({ docType, creators, reviewers, editRoles, approveRoles }) => ({
    docType,
    creators,
    reviewers,
    editRoles,
    approveRoles,
  })),
});
