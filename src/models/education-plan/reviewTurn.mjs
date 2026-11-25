/**
 * Hồ sơ Chờ duyệt có chuỗi nhiều người duyệt (EDU-93): ai đúng lượt, nhãn trạng thái cho người khác, ai thuộc chuỗi duyệt.
 * Chỉ để hiển thị; quyền duyệt thật do BE trả trong `permissions` và kiểm lại khi thao tác.
 */

const waitingRoleOf = (doc) => doc?.review?.waitingRole ?? doc?.waitingRole ?? null;

/** Có quyền thao tác duyệt/trả lại; `null` khi tài liệu không kèm `permissions`. */
export function isReviewTurn(doc) {
  const p = doc?.permissions;
  if (!p) return null;
  return !!(p.canApprove ?? p.canIssue) || !!(p.canReject ?? p.canReturn);
}

/** "Đang chờ <vai trò> duyệt" cho người không đúng lượt; null ⇒ giữ nhãn "Chờ duyệt" bình thường. */
export function waitingLabel(doc, roleLabels = {}) {
  if (doc?.status !== 'REVIEW' || !(doc.review?.roles?.length >= 2)) return null;
  const role = waitingRoleOf(doc);
  // Đúng lượt vẫn giữ nguyên khi hết hạn và các nút duyệt bị khóa (EDU-97).
  const currentReviewer = doc.reviewDeadline?.isCurrentReviewer ?? doc.timeLock?.reviewDeadline?.isCurrentReviewer;
  if (!role || (currentReviewer ?? isReviewTurn(doc)) !== false) return null;
  return `Đang chờ ${roleLabels[role] || role} duyệt`;
}

/**
 * Người dùng giữ một vai trò duyệt trong chuỗi của hồ sơ lớp, đúng phạm vi hiển thị: Tổ trưởng chỉ nhóm tuổi mình phụ trách;
 * PHT/HT theo danh sách lớp đã được BE giới hạn sẵn.
 */
export function isChainReviewer(doc, user, cls) {
  if (doc?.status !== 'REVIEW' || !cls || !user) return false;
  const roles = doc.review?.roles || [];
  if (!roles.includes(user.role)) return false;
  return user.role !== 'TEAM_LEADER' || String(cls.ageGroupId) === String(user.ageGroupId);
}
