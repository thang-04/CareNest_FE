import { PERMISSION_ROLE_LABELS } from '@/models/account/permissionConstants';

/*
 * Ô soạn/duyệt 8 mã EDU trên ma trận vai trò (BE EDU-110 (2)–(8), EduWorkflowPolicyDeriver).
 * Chỉ để khóa ô và báo sớm; BE kiểm lại khi lưu (7202 SIGNERS_INVALID + data.issues).
 * `matrix` = { [role]: mã đang tick theo bản nháp }.
 */
export const EDU_DOC_TYPES = [
  { docType: 'SCHOOL_YEAR', label: 'Kế hoạch năm học', edit: 'EDU_SCHOOL_YEAR_PLAN_EDIT', approve: 'EDU_SCHOOL_YEAR_PLAN_APPROVE' },
  { docType: 'TEAM', label: 'Kế hoạch tổ', edit: 'EDU_TEAM_PLAN_EDIT', approve: 'EDU_TEAM_PLAN_APPROVE' },
  { docType: 'SEMESTER_PACKAGE', label: 'Gói học kỳ', edit: 'EDU_SEMESTER_PACKAGE_EDIT', approve: 'EDU_SEMESTER_PACKAGE_APPROVE' },
  { docType: 'THEME_PLAN', label: 'Hồ sơ chủ đề', edit: 'EDU_THEME_PLAN_EDIT', approve: 'EDU_THEME_PLAN_APPROVE' },
];

export const EDU_WORKFLOW_CODES = EDU_DOC_TYPES.flatMap((doc) => [doc.edit, doc.approve]);
export const isEduWorkflowCode = (code) => EDU_WORKFLOW_CODES.includes(code);

// Cấp thấp → cao, cấp dưới duyệt trước (EDU-110 (4), (8))
const EDU_RANK = ['TEACHER', 'TEAM_LEADER', 'VICE_PRINCIPAL', 'PRINCIPAL'];
const rank = (role) => EDU_RANK.indexOf(role);
const roleName = (role) => PERMISSION_ROLE_LABELS[role] || role;
const docOf = (code) => EDU_DOC_TYPES.find((doc) => doc.edit === code || doc.approve === code);
const docByType = (docType) => EDU_DOC_TYPES.find((doc) => doc.docType === docType);
const rolesWith = (matrix, code) => EDU_RANK.filter((role) => (matrix[role] || []).includes(code));

export const eduCellLabel = (code, role) => {
  const doc = docOf(code);
  return `${doc.label} – ${code === doc.edit ? 'Soạn' : 'Duyệt'}: ${roleName(role)}`;
};

/** Lý do ô đang khóa (chưa tick mà tick vào sẽ sai luật); null = tick được. Ô đã tick luôn bỏ được. */
export function eduCellLock(matrix, role, code) {
  const doc = docOf(code);
  if (!doc || (matrix[role] || []).includes(code)) return null;
  const creators = rolesWith(matrix, doc.edit);
  if (code === doc.edit) {
    const other = creators.find((r) => r !== role);
    if (other) return `Mỗi loại hồ sơ chỉ một vai trò soạn. Bỏ tick ${roleName(other)} trước khi chọn vai trò khác.`;
    // HT tick Soạn thì dòng Duyệt tự bỏ hết (eduApproveToClear), kể cả ô Duyệt của HT
    if (role !== 'PRINCIPAL' && (matrix[role] || []).includes(doc.approve)) return 'Vai trò soạn không duyệt hồ sơ cùng loại.';
    return null;
  }
  if (creators.includes(role)) return 'Vai trò soạn không duyệt hồ sơ cùng loại.';
  if (creators.includes('PRINCIPAL')) return 'Hiệu trưởng soạn và ban hành, không cần duyệt.';
  if (creators.length === 1 && rank(role) <= rank(creators[0])) return 'Người duyệt phải cấp cao hơn người soạn.';
  return null;
}

/**
 * HT tick Soạn loại X ⇒ dòng Duyệt loại X trống (EDU-110 (8)): trả `{ code, roles }` các vai trò cần tự bỏ tick Duyệt; không có ⇒ null.
 */
export function eduApproveToClear(matrix, role, code, on) {
  const doc = docOf(code);
  if (!on || role !== 'PRINCIPAL' || !doc || code !== doc.edit) return null;
  const roles = rolesWith(matrix, doc.approve);
  return roles.length ? { code: doc.approve, roles } : null;
}

/** Lỗi theo loại hồ sơ, cùng mã luật với BE (`EduWorkflowIssuesResponse`). */
export function eduLocalIssues(matrix) {
  return EDU_DOC_TYPES.flatMap(({ docType, edit, approve }) => {
    const creators = rolesWith(matrix, edit);
    const reviewers = rolesWith(matrix, approve);
    const issues = [];
    if (creators.length !== 1) issues.push({ docType, rule: 'CREATOR_NOT_EXACTLY_ONE', roles: creators });
    if (reviewers.includes('TEACHER')) issues.push({ docType, rule: 'TEACHER_REVIEWER', roles: ['TEACHER'] });
    const both = creators.filter((r) => reviewers.includes(r));
    if (both.length) issues.push({ docType, rule: 'CREATOR_IS_REVIEWER', roles: both });
    if (creators.length === 1) {
      const [creator] = creators;
      const lower = reviewers.filter((r) => r !== creator && rank(r) <= rank(creator));
      if (lower.length) issues.push({ docType, rule: 'REVIEWER_NOT_ABOVE_CREATOR', roles: lower });
      if (!reviewers.length && creator !== 'PRINCIPAL') issues.push({ docType, rule: 'NO_REVIEWER', roles: [] });
    }
    return issues;
  });
}

export function eduIssueText({ docType, rule, roles = [] }) {
  const label = docByType(docType)?.label || docType;
  const names = roles.map(roleName).join(', ');
  const text = {
    CREATOR_NOT_EXACTLY_ONE: roles.length ? `chỉ được một vai trò Soạn (đang tick ${names})` : 'cần đúng một vai trò Soạn',
    NO_REVIEWER: 'cần ít nhất một vai trò Duyệt',
    TEACHER_REVIEWER: 'Giáo viên không duyệt được',
    CREATOR_IS_REVIEWER: `vai trò soạn không duyệt hồ sơ cùng loại (${names})`,
    REVIEWER_NOT_ABOVE_CREATOR: `người duyệt phải cấp cao hơn người soạn (${names})`,
  }[rule];
  return `${label}: ${text || rule}.`;
}

/** Dòng chuỗi duyệt dưới nhóm (EDU-110 (4), (8)). */
export function eduChainLabel(matrix, docType) {
  const doc = docByType(docType);
  const creators = rolesWith(matrix, doc.edit);
  if (creators.length === 1 && creators[0] === 'PRINCIPAL') return `${doc.label}: Hiệu trưởng soạn và ban hành, không cần duyệt.`;
  const reviewers = rolesWith(matrix, doc.approve);
  return `${doc.label} – chuỗi duyệt: ${reviewers.length ? reviewers.map(roleName).join(' → ') : 'chưa có'}.`;
}

/** Bản nháp có đổi mã EDU của vai trò nào không (BE chỉ kiểm luật khi lần lưu đổi mã EDU). */
export const eduCodesChanged = (before, after) =>
  Object.keys({ ...before, ...after }).some((role) =>
    EDU_WORKFLOW_CODES.some((code) => (before[role] || []).includes(code) !== (after[role] || []).includes(code)),
  );

/** Câu báo khi lưu ma trận lỗi theo mã lỗi BE; mã khác dùng câu BE trả. */
export const eduSaveErrorMessage = (error) =>
  ({
    7202: 'Cấu hình soạn/duyệt chưa đúng luật. Xem các dòng lỗi ở nhóm Kế hoạch giáo dục – soạn/duyệt.',
    7201: 'Chỉ Hiệu trưởng đang có phân công mới đổi được quyền soạn/duyệt.',
    1118: 'Có quyền không cấu hình được cho vai trò đã chọn. Tải lại trang rồi thử lại.',
  })[error?.errorCode] ||
  error?.message ||
  'Có lỗi khi lưu.';
