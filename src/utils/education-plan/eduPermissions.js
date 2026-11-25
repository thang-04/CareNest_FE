import { ROLES } from '@/models/User';
import { hasBePermission } from '@/utils/bePermissions';

/*
 * Mã kế hoạch giáo dục của BE (EDU-108) để ẩn/hiện; BE vẫn kiểm mọi thao tác và trả cờ can* theo mã.
 * Mock không có bePermissions ⇒ hasBePermission cho qua, giữ hành vi theo vai trò như trước.
 */
export const EDU_EDIT_CODES = ['EDU_SCHOOL_YEAR_PLAN_EDIT', 'EDU_TEAM_PLAN_EDIT', 'EDU_SEMESTER_PACKAGE_EDIT', 'EDU_THEME_PLAN_EDIT'];
export const EDU_APPROVE_CODES = [
  'EDU_SCHOOL_YEAR_PLAN_APPROVE',
  'EDU_TEAM_PLAN_APPROVE',
  'EDU_SEMESTER_PACKAGE_APPROVE',
  'EDU_THEME_PLAN_APPROVE',
];

export const canEduApprove = (user) => hasBePermission(user, ...EDU_APPROVE_CODES);

/** PHT có ít nhất một mã soạn/duyệt; PHT chỉ xem (thường là dinh dưỡng) chỉ thấy bản đã ban hành (FR5.1). */
export const isEduVicePrincipal = (user) =>
  user?.role === ROLES.VICE_PRINCIPAL && hasBePermission(user, ...EDU_EDIT_CODES, ...EDU_APPROVE_CODES);

/**
 * HT ban hành thẳng (BE EDU-110 (8), (10), (11)): policy loại hồ sơ có HT soạn, chuỗi duyệt rỗng; hồ sơ Nháp (HT là tác giả)
 * hoặc Chờ duyệt. `policy` = eduConfig.workflowPolicy[loại] (BE suy từ ma trận vai trò). Chỉ ẩn/hiện; BE kiểm lại.
 */
export const canPrincipalPublish = ({ user, policy, status, author }) =>
  user?.role === ROLES.PRINCIPAL &&
  policy?.creators?.length === 1 &&
  policy.creators[0] === ROLES.PRINCIPAL &&
  !policy.reviewers?.length &&
  (status === 'REVIEW' || (!!author && ['DRAFT', 'REJECTED', 'EDITING'].includes(status)));
