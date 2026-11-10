// Spec 003: nhãn hạn của gói học kỳ / hồ sơ chủ đề. BE tính deadlineState, daysLeft; FE chỉ hiển thị.

const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

/** { tone, label } cho StatusBadge; null khi không có hạn (năm chưa cấu hình học kỳ). */
export function deadlineLabel(doc) {
  if (!doc?.deadline) return null;
  const due = ddmm(doc.extendedTo || doc.deadline);
  switch (doc.deadlineState) {
    case 'NEAR':
      return { tone: 'orange', label: doc.daysLeft == null ? `Gần đến hạn (${due})` : `Gần đến hạn · còn ${doc.daysLeft} ngày (${due})` };
    case 'OVERDUE':
      return { tone: 'red', label: `Quá hạn (${due})` };
    case 'ON_TIME':
      return { tone: 'green', label: 'Đúng hạn' };
    case 'LATE':
      return { tone: 'teal', label: 'Ban hành trễ' };
    default:
      return { tone: 'gray', label: `Hạn ${due}` };
  }
}

/** Lý do không gửi được (blockedReason của BE). */
export const BLOCKED_TEXT = {
  DEADLINE_PASSED: 'Đã quá hạn. Cần Hiệu trưởng hoặc Phó hiệu trưởng mở khóa.',
  SEMESTER_NOT_RELEASED: 'Học kỳ chưa được duyệt.',
};

/** Khóa gói học kỳ của lớp + kế hoạch tổ (sp_), hồ sơ chủ đề (ds_), giáo án ngày (dd_) theo khóa giáo án tuần. */
export const semesterKey = (classId, yearPlanId, no) => `sp_${classId}_${yearPlanId}_${no}`;
export const dossierKey = (classId, themeId) => `ds_${classId}_${themeId}`;
export const dayKeyOf = (weekKey) => (weekKey?.startsWith('wp_') ? `dd_${weekKey.slice(3)}` : weekKey);
