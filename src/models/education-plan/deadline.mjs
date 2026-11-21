// BE quyết định hạn theo EDU-74/76/94. Nhãn tự cập nhật khi tab còn mở qua ngày.

const ddmm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

/** { tone, label } cho StatusBadge; null khi không có hạn (năm chưa cấu hình học kỳ). */
const dayBefore = (iso) => new Date(Date.parse(`${iso}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);

const schoolDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' });
export const deadlineToday = () => schoolDate.format();

export function deadlineLabel(doc, today) {
  if (!doc?.deadline) return null;
  const official = doc.extendedTo || doc.deadline;
  // Trả lại sau hạn: BE cho gửi lại tới hết ngày trước graceTo (Tiền 18/11/2026)
  const grace = doc.graceTo && doc.graceTo > official ? doc.graceTo : null;
  const effective = grace || official;
  const due = ddmm(effective);
  if (doc.deadlineState === 'NEAR' && today && today >= effective) {
    return { tone: 'red', label: `Hạn: Quá hạn (${due})` };
  }
  if (grace && (doc.deadlineState === 'NEAR' || doc.deadlineState === 'NORMAL'))
    return { tone: 'orange', label: `Hạn: Gửi lại trước hết ${ddmm(dayBefore(grace))}` };
  switch (doc.deadlineState) {
    case 'NEAR':
      return {
        tone: 'orange',
        label: doc.daysLeft == null ? `Hạn: Gần đến hạn (${due})` : `Hạn: Gần đến hạn · còn ${doc.daysLeft} ngày (${due})`,
      };
    case 'OVERDUE':
      return { tone: 'red', label: `Hạn: Quá hạn (${due})` };
    case 'ON_TIME':
      return { tone: 'green', label: 'Hạn: Đúng hạn' };
    case 'LATE':
      return { tone: 'teal', label: 'Hạn: Ban hành trễ' };
    default:
      return { tone: 'gray', label: `Hạn: ${due}` };
  }
}

/** Lý do không gửi được (blockedReason của BE). */
export const BLOCKED_TEXT = {
  DEADLINE_PASSED: 'Quá hạn — chờ Hiệu trưởng mở hạn.',
  // BE:EDU-75 — kế hoạch giáo dục chủ đề chưa ban hành vẫn soạn/lưu được giáo án ngày, chỉ chưa gửi kế hoạch giáo dục ngày
  SEMESTER_NOT_RELEASED:
    'Kế hoạch giáo dục chủ đề của học kỳ chưa ban hành nên chưa gửi duyệt được kế hoạch giáo dục ngày. Vẫn soạn và lưu giáo án ngày bình thường; kế hoạch giáo dục chủ đề gửi duyệt ở trang Kế hoạch giáo dục chủ đề.',
};

/** Khóa kế hoạch giáo dục chủ đề của lớp + kế hoạch tổ (sp_), kế hoạch giáo dục ngày (ds_), giáo án ngày (dd_) theo khóa giáo án tuần. */
export const semesterKey = (classId, yearPlanId, no) => `sp_${classId}_${yearPlanId}_${no}`;
export const dossierKey = (classId, themeId) => `ds_${classId}_${themeId}`;
export const dayKeyOf = (weekKey) => (weekKey?.startsWith('wp_') ? `dd_${weekKey.slice(3)}` : weekKey);
