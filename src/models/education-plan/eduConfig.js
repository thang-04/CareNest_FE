/*
 * Cấu hình kế hoạch giáo dục của trường (Phó HT / Hiệu trưởng sửa ở trang Cấu hình):
 * tên hiển thị 5 lĩnh vực, người ký theo từng loại tài liệu, các dòng hoạt động của kế hoạch tuần.
 * Quy tắc ai ký / ai duyệt là nghiệp vụ: bản này chạy trên mock, BE phải sở hữu cấu hình thật.
 */
import { DOMAINS, STANDARD_DOMAINS, setDomainLabelOverrides, setDomains } from '@/models/education-plan/educationPlanConstants';

export const SIGN_ROLES = { TEAM_LEADER: 'Tổ trưởng', VICE_PRINCIPAL: 'Phó hiệu trưởng', PRINCIPAL: 'Hiệu trưởng' };

/** Trạng thái chờ của từng vai trò duyệt. */
export const PENDING_OF = { TEAM_LEADER: 'PENDING_TL', VICE_PRINCIPAL: 'PENDING_VP', PRINCIPAL: 'PENDING_HT' };

export const SIGN_DOCS = [
  {
    key: 'year',
    label: 'Kế hoạch năm học',
    hint: 'Tổ trưởng hoặc Phó HT soạn; Tổ trưởng gửi, Phó HT duyệt ban hành; bản in có chỗ ký tay của những người này.',
  },
  { key: 'branch', label: 'Chủ đề nhánh và thời gian', hint: 'Giáo viên soạn, gửi; người duyệt theo thứ tự rồi in ra ký tay.' },
  {
    key: 'week',
    label: 'Kế hoạch giáo dục chủ đề (kế hoạch chủ đề + giáo án các nhánh)',
    hint: 'Giáo viên gửi cả hồ sơ một lần (không ký); mỗi tuần duyệt riêng, người duyệt ký khung duyệt của tuần đó; kế hoạch chủ đề duyệt cùng tuần 1.',
  },
];

export const DEFAULT_WEEK_ROWS = [
  { key: 'don', label: 'Đón trẻ', canMerge: true, allWeek: true },
  { key: 'tro_chuyen', label: 'Trò chuyện', canMerge: true, allWeek: true },
  { key: 'the_duc', label: 'Thể dục sáng', canMerge: true, allWeek: true },
  { key: 'hoc', label: 'Hoạt động học', canMerge: false, allWeek: false },
  // extraLabel: dòng có thêm phần chung cả tuần dưới 5 ô ngày (mẫu Thái Dương: "Chơi tự do", "Chơi tự chọn", "Nêu gương")
  { key: 'ngoai_troi', label: 'Chơi, hoạt động ngoài trời', canMerge: false, allWeek: false, extraLabel: 'Chơi tự do (cả tuần)' },
  { key: 'goc', label: 'Chơi, hoạt động ở các góc', canMerge: true, allWeek: true },
  {
    key: 'chieu',
    label: 'Chơi, hoạt động buổi chiều',
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
  signers: {
    year: ['TEAM_LEADER', 'VICE_PRINCIPAL'],
    // Tiền chốt 16/10: chủ đề nhánh cũng Tổ trưởng duyệt rồi Phó HT (bỏ Tổ trưởng khi Tổ trưởng dạy lớp đó)
    branch: ['TEAM_LEADER', 'VICE_PRINCIPAL'],
    // Tiền chốt 15/10: giáo án tuần (tuần đầu kèm kế hoạch chủ đề) Tổ trưởng duyệt rồi Phó HT duyệt
    week: ['TEAM_LEADER', 'VICE_PRINCIPAL'],
  },
  weekRows: DEFAULT_WEEK_ROWS,
};

/** Cấu hình đầy đủ (bổ sung phần còn thiếu bằng mặc định). */
export const withDefaults = (cfg) => ({
  domainLabels: { ...DEFAULT_EDU_CONFIG.domainLabels, ...(cfg?.domainLabels || {}) },
  extraDomains: (cfg?.extraDomains || []).filter((d) => d?.trim() && !STANDARD_DOMAINS.includes(d)),
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
