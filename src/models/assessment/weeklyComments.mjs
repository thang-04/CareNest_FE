// Nhận xét tuần theo trẻ (BE OBS-29): kiểm nội dung, nhãn trạng thái, đếm để hiện trên màn GV

export const WEEKLY_COMMENT_MAX = 2000;

export const WEEKLY_STATUS = { NONE: 'NONE', DRAFT: 'DRAFT', SENT: 'SENT' };

/** Lỗi của ô nội dung (giống câu BE 7340 / 7342); gửi phụ huynh thì bắt buộc có nội dung. */
export const contentError = (text, { sending = false } = {}) => {
  const value = (text || '').trim();
  if (sending && !value) return 'Nhập nội dung đánh giá';
  if (value.length > WEEKLY_COMMENT_MAX) return `Nội dung đánh giá tối đa ${WEEKLY_COMMENT_MAX} ký tự`;
  return '';
};

/** Chip trạng thái của từng trẻ trong danh sách bên trái. */
export const statusChip = (row) => {
  if (row.status === WEEKLY_STATUS.SENT) return { label: 'Đã gửi', tone: 'green' };
  if (row.status === WEEKLY_STATUS.DRAFT && (row.content || '').trim()) return { label: 'Nháp', tone: 'orange' };
  if (row.absentAllWeek) return { label: 'Nghỉ cả tuần', tone: 'gray' };
  return { label: 'Chưa có', tone: 'gray' };
};

/** Số bản nháp có nội dung (gửi cả lớp) và số đã gửi / tổng trẻ. */
export const boardCounts = (rows = []) => ({
  total: rows.length,
  sent: rows.filter((r) => r.status === WEEKLY_STATUS.SENT).length,
  ready: rows.filter((r) => r.status === WEEKLY_STATUS.DRAFT && (r.content || '').trim()).length,
});

/** Ô số liệu tuần của một trẻ (bên trên ô nhận xét). */
export const weekDataCells = (data) =>
  data
    ? [
        { key: 'present', label: 'Đi học', value: `${data.presentDays}/${data.schoolDays} ngày` },
        { key: 'goals', label: 'Mục tiêu đạt', value: data.goalsTotal ? `${data.goalsMet}/${data.goalsTotal}` : '—' },
        {
          key: 'flags',
          label: 'Cờ bé ngoan',
          value: data.weeklyTicket ? `${data.flagCount} · có phiếu tuần` : String(data.flagCount),
        },
        { key: 'lunch', label: 'Ăn hết suất trưa', value: data.lunchDays ? `${data.lunchFinished}/${data.lunchDays} ngày` : '—' },
      ]
    : [];

const dm = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');

/** Nhãn tuần trong ô chọn (BE OBS-29: tuần theo giáo án tuần đã duyệt, chưa có giáo án thì thứ Hai–Sáu). */
export const weekOptionLabel = (w) => {
  if (!w) return '';
  const range = `${dm(w.from)}–${dm(w.to)}`;
  const parts = [w.label ? `${w.label} · ${range}` : range];
  if (!w.open) parts.push('Chưa tới cuối tuần');
  return parts.join(' · ');
};
