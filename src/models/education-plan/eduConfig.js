/*
 * Cấu hình kế hoạch giáo dục của trường (Phó HT / Hiệu trưởng sửa ở trang Cấu hình):
 * tên hiển thị 5 lĩnh vực, người ký theo từng loại tài liệu, các dòng hoạt động của kế hoạch tuần.
 * Quy tắc ai ký / ai duyệt là nghiệp vụ: bản này chạy trên mock, BE phải sở hữu cấu hình thật.
 */
import { DOMAINS, STANDARD_DOMAINS, setDomainLabelOverrides, setDomains } from '@/models/education-plan/educationPlanConstants';

export const SIGN_ROLES = { TEAM_LEADER: 'Tổ trưởng', VICE_PRINCIPAL: 'Phó hiệu trưởng', PRINCIPAL: 'Hiệu trưởng' };

export const WORKFLOW_ROLES = {
  TEACHER: 'Giáo viên',
  TEAM_LEADER: 'Tổ trưởng',
  VICE_PRINCIPAL: 'Phó hiệu trưởng',
  PRINCIPAL: 'Hiệu trưởng',
};

export const CREATOR_ROLES = ['TEACHER', 'TEAM_LEADER', 'VICE_PRINCIPAL', 'PRINCIPAL'];
export const REVIEWER_ROLES = ['TEAM_LEADER', 'VICE_PRINCIPAL', 'PRINCIPAL'];

export const DEFAULT_WORKFLOW_POLICY = {
  schoolYear: { creators: ['VICE_PRINCIPAL'], reviewers: ['PRINCIPAL'] },
  year: { creators: ['TEAM_LEADER'], reviewers: ['VICE_PRINCIPAL'] },
  branch: { creators: ['TEACHER'], reviewers: ['TEAM_LEADER', 'VICE_PRINCIPAL'] },
  theme: { creators: ['TEACHER'], reviewers: ['TEAM_LEADER', 'VICE_PRINCIPAL'] },
};

/** Trạng thái chờ của từng vai trò duyệt. */
export const PENDING_OF = { TEAM_LEADER: 'PENDING_TL', VICE_PRINCIPAL: 'PENDING_VP', PRINCIPAL: 'PENDING_HT' };

export const SIGN_DOCS = [
  { key: 'schoolYear', label: 'Kế hoạch năm học', hint: 'Phó hiệu trưởng soạn; Hiệu trưởng duyệt.' },
  {
    key: 'year',
    label: 'Kế hoạch giáo dục tổ',
    hint: 'Tổ trưởng chuyên môn soạn; Phó Hiệu trưởng hoặc Hiệu trưởng duyệt ban hành.',
  },
  {
    key: 'branch',
    label: 'Chủ đề nhánh, kế hoạch chủ đề, kế hoạch tuần',
    hint: 'Giáo viên soạn, gửi theo học kỳ (gói học kỳ); Tổ trưởng và Phó Hiệu trưởng duyệt theo thứ tự.',
  },
  {
    key: 'theme',
    label: 'Kế hoạch giáo dục ngày',
    hint: 'Giáo viên soạn, gửi theo chủ đề (hồ sơ chủ đề); Tổ trưởng và Phó Hiệu trưởng duyệt theo thứ tự.',
  },
  {
    key: 'week',
    label: 'Kế hoạch tuần (cách duyệt cũ)',
    hint: 'Giáo viên gửi cả hồ sơ một lần (không ký); mỗi tuần duyệt riêng, người duyệt ký khung duyệt của tuần đó; kế hoạch chủ đề duyệt cùng tuần 1.',
  },
];

export const DEFAULT_WEEK_ROWS = [
  { key: 'don', label: 'Đón trẻ', canMerge: true, allWeek: true },
  { key: 'tro_chuyen', label: 'Trò chuyện', canMerge: true, allWeek: true },
  { key: 'the_duc', label: 'Thể dục sáng', canMerge: true, allWeek: true },
  { key: 'hoc', label: 'Hoạt động học', canMerge: false, allWeek: false },
  // extraLabel: dòng có thêm phần chung cả tuần dưới 5 ô ngày (mẫu Thái Dương: "Chơi tự do", "Chơi tự chọn", "Nêu gương")
  { key: 'goc', label: 'Hoạt động góc', canMerge: true, allWeek: true },
  { key: 'ngoai_troi', label: 'Hoạt động ngoài trời', canMerge: false, allWeek: false, extraLabel: 'Chơi tự do (cả tuần)' },
  { key: 'an_ngu', label: 'Ăn, ngủ', canMerge: true, allWeek: true },
  {
    key: 'chieu',
    label: 'Hoạt động chiều',
    canMerge: false,
    allWeek: false,
    extraLabel: 'Chơi tự chọn; nêu gương cuối ngày (cả tuần)',
  },
  { key: 'tra_tre', label: 'Trả trẻ', canMerge: true, allWeek: true },
];

export const DEFAULT_EDU_CONFIG = {
  domainLabels: { 'Phát triển thẩm mỹ': 'Phát triển thẩm mỹ (Nghệ thuật)' },
  // Lĩnh vực trường thêm sau 5 lĩnh vực chuẩn (khi Bộ bổ sung), theo thứ tự hiển thị
  extraDomains: [],
  workflowPolicy: DEFAULT_WORKFLOW_POLICY,
  workflowRevision: 1,
  signers: {
    year: ['TEAM_LEADER', 'VICE_PRINCIPAL'],
    // Tiền chốt 16/10: chủ đề nhánh cũng Tổ trưởng duyệt rồi Phó HT (bỏ Tổ trưởng khi Tổ trưởng dạy lớp đó)
    branch: ['TEAM_LEADER', 'VICE_PRINCIPAL'],
    // Tiền chốt 15/10: giáo án tuần (tuần đầu kèm kế hoạch chủ đề) Tổ trưởng duyệt rồi Phó HT duyệt
    week: ['TEAM_LEADER', 'VICE_PRINCIPAL'],
    theme: ['TEAM_LEADER', 'VICE_PRINCIPAL'],
  },
  weekRows: DEFAULT_WEEK_ROWS,
};

export const DEFAULT_DURATION = { theme: { minWeeks: 2, maxWeeks: 4 }, branch: { minWeeks: 1, maxWeeks: 2 } };

/**
 * "Khôi phục mặc định" của trang Cấu hình (Tiền 11/11/2026): đưa thời lượng, tên lĩnh vực, lĩnh vực thêm, người tạo/duyệt và dòng
 * kế hoạch tuần về mặc định; giữ số phiên bản và các cờ quyền BE trả. Chỉ đổi bản đang sửa, bấm Lưu mới ghi.
 */
export const resetEduConfig = (cfg) => ({
  ...cfg,
  domainLabels: { ...DEFAULT_EDU_CONFIG.domainLabels },
  extraDomains: [],
  workflowPolicy: structuredClone(DEFAULT_WORKFLOW_POLICY),
  durationPolicy: { ...cfg.durationPolicy, ...structuredClone(DEFAULT_DURATION) },
  weekRows: structuredClone(DEFAULT_WEEK_ROWS),
});

/** Cấu hình đầy đủ (bổ sung phần còn thiếu bằng mặc định). */
export const withDefaults = (cfg) => ({
  domainLabels: { ...DEFAULT_EDU_CONFIG.domainLabels, ...(cfg?.domainLabels || {}) },
  extraDomains: (cfg?.extraDomains || []).filter((d) => d?.trim() && !STANDARD_DOMAINS.includes(d)),
  workflowPolicy: cfg?.workflowPolicy
    ? {
        schoolYear: cfg.workflowPolicy.schoolYear || DEFAULT_WORKFLOW_POLICY.schoolYear,
        year: cfg.workflowPolicy.year || DEFAULT_WORKFLOW_POLICY.year,
        branch: cfg.workflowPolicy.branch || DEFAULT_WORKFLOW_POLICY.branch,
        theme: cfg.workflowPolicy.theme || cfg.workflowPolicy.week || DEFAULT_WORKFLOW_POLICY.theme,
      }
    : DEFAULT_WORKFLOW_POLICY,
  durationPolicyAvailable: cfg?.durationPolicyAvailable ?? true,
  workflowRevision: cfg?.workflowRevision ?? 1,
  durationPolicy: cfg?.durationPolicy || { revision: 1, ...DEFAULT_DURATION },
  ...(cfg?.schoolYearCreationScopes ? { schoolYearCreationScopes: cfg.schoolYearCreationScopes } : {}),
  canConfigure: cfg?.canConfigure ?? false,
  ...(cfg?.yearCreationScopes ? { yearCreationScopes: cfg.yearCreationScopes } : {}),
  signers: { ...DEFAULT_EDU_CONFIG.signers, ...(cfg?.signers || {}) },
  // Cấu hình đã lưu trước khi có phần chung cả tuần: lấy extraLabel mặc định theo khóa dòng
  weekRows: cfg?.weekRows?.length
    ? cfg.weekRows.map((r) => ('extraLabel' in r ? r : { ...r, extraLabel: DEFAULT_WEEK_ROWS.find((d) => d.key === r.key)?.extraLabel }))
    : DEFAULT_WEEK_ROWS,
  signerNames: {
    principals: cfg?.signerNames?.principals || [],
    vicePrincipals: cfg?.signerNames?.vicePrincipals || [],
    teamLeaders: cfg?.signerNames?.teamLeaders || {},
  },
});

/**
 * Họ tên in sẵn cho vai trò khi chưa có người ban hành, duyệt (BE:EDU-21): Tổ trưởng của nhóm tuổi trong năm học đó;
 * Hiệu trưởng / Phó HT chỉ khi trường có đúng một người giữ vai trò đó (nhiều Phó HT thì để trống cho ký tay — Tiền 31/10).
 */
export const soleSignerName = (role, ageGroupId, schoolYear = '') => {
  const { principals, vicePrincipals, teamLeaders } = current.signerNames;
  const list =
    role === 'PRINCIPAL'
      ? principals
      : role === 'VICE_PRINCIPAL'
        ? vicePrincipals
        : role === 'TEAM_LEADER'
          ? teamLeaders[String(schoolYear).replace(/\s*[-–]\s*/, '-')]?.[ageGroupId] || []
          : [];
  return list.length === 1 ? list[0] : '';
};

// Cấu hình đang dùng: các màn hình và file xuất đọc cùng một bản (nạp khi mở module kế hoạch giáo dục)
let current = withDefaults(null);

export const getEduConfig = () => current;

export const applyEduConfig = (cfg) => {
  current = withDefaults(cfg);
  setDomains([...STANDARD_DOMAINS, ...current.extraDomains]);
  setDomainLabelOverrides(Object.fromEntries(DOMAINS.map((d) => [d, current.domainLabels[d]]).filter(([, v]) => v?.trim())));
};

/** Hiệu trưởng có trong chuỗi ký của ít nhất một loại tài liệu (kế hoạch năm, chủ đề nhánh, giáo án tuần). */
export const principalSigns = (cfg) =>
  (cfg?.durationPolicyAvailable !== false &&
    Object.values(withDefaults(cfg).workflowPolicy).some((policy) => policy.reviewers.includes('PRINCIPAL'))) ||
  Object.values(withDefaults(cfg).signers).some((chain) => chain.includes('PRINCIPAL'));

/** Vai trò của người ký đã lưu (bản ký cũ chỉ có chức danh). */
export const roleOfSigner = (s) =>
  s?.roleKey ||
  (/^tổ trưởng/i.test(s?.role || '')
    ? 'TEAM_LEADER'
    : /^phó hiệu trưởng/i.test(s?.role || '')
      ? 'VICE_PRINCIPAL'
      : /^hiệu trưởng/i.test(s?.role || '')
        ? 'PRINCIPAL'
        : null);
