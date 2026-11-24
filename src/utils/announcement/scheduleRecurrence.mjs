/*
 * Nhịp lặp của lịch gửi thông báo (PAR-10, BE sở hữu rule): mỗi ngày, nhiều thứ trong tuần (cách 1–4 tuần), hằng tháng,
 * kèm ngày bắt đầu/kết thúc tùy chọn. Tệp này chỉ chuẩn hóa dữ liệu form, tạo nhãn và kiểm ô nhập để gợi ý sớm;
 * BE kiểm lại và quyết định hợp lệ.
 */
export const FREQUENCIES = [
  { value: 'DAILY', label: 'Mỗi ngày' },
  { value: 'WEEKLY', label: 'Hằng tuần' },
  { value: 'MONTHLY', label: 'Hằng tháng' },
];

/** Thứ Hai = 1 … Chủ nhật = 7 (theo BE). */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7].map((value) => ({
  value,
  short: value === 7 ? 'CN' : `T${value + 1}`,
  label: value === 7 ? 'Chủ nhật' : `Thứ ${value + 1}`,
}));
export const INTERVAL_OPTIONS = [1, 2, 3, 4].map((value) => ({ value, label: value === 1 ? 'Mỗi tuần' : `Mỗi ${value} tuần` }));

const sortedDays = (days) => [...new Set((days || []).map(Number))].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b);

/** Các thứ của lịch tuần: `daysOfWeek` nếu có, ngược lại `dayOfWeek` cũ (một thứ). */
export const daysOf = (item) => {
  const days = sortedDays(item?.daysOfWeek);
  if (days.length) return days;
  return item?.dayOfWeek ? sortedDays([item.dayOfWeek]) : [];
};

/** Lịch hiện có (hoặc mặc định cho lịch mới) ⇒ trạng thái ô nhập của form. */
export function scheduleFromInitial(initial) {
  return {
    frequency: initial?.frequency || 'WEEKLY',
    daysOfWeek: initial ? daysOf(initial) : [1],
    intervalWeeks: initial?.intervalWeeks || 1,
    dayOfMonth: initial?.dayOfMonth ?? '',
    sendTime: initial?.sendTime?.slice(0, 5) || '08:00',
    startDate: initial?.startDate || '',
    endDate: initial?.endDate || '',
    active: initial?.active ?? true,
  };
}

/** Trạng thái ô nhập ⇒ trường gửi BE; trường không thuộc kiểu đã chọn gửi null, ngày trống gửi null. */
export function schedulePayload(state) {
  const weekly = state.frequency === 'WEEKLY';
  return {
    frequency: state.frequency,
    daysOfWeek: weekly ? sortedDays(state.daysOfWeek) : null,
    intervalWeeks: weekly ? Number(state.intervalWeeks) || 1 : null,
    dayOfWeek: null,
    dayOfMonth: state.frequency === 'MONTHLY' ? Number(state.dayOfMonth) : null,
    sendTime: state.sendTime,
    startDate: state.startDate || null,
    endDate: state.endDate || null,
    active: state.active,
  };
}

/** Lỗi ô nhập theo tên trường (cùng tên trường BE trả); rỗng = không có lỗi để gợi ý. */
export function scheduleFieldErrors(state) {
  const errors = {};
  if (!state.sendTime) errors.sendTime = 'Chọn giờ gửi.';
  if (state.frequency === 'WEEKLY') {
    if (!sortedDays(state.daysOfWeek).length) errors.daysOfWeek = 'Chọn ít nhất một thứ trong tuần.';
    if (![1, 2, 3, 4].includes(Number(state.intervalWeeks))) errors.intervalWeeks = 'Chọn lặp mỗi 1 đến 4 tuần.';
  }
  if (state.frequency === 'MONTHLY') {
    const day = Number(state.dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 31) errors.dayOfMonth = 'Nhập ngày từ 1 đến 31.';
  }
  if (state.endDate && state.startDate && state.endDate < state.startDate) errors.endDate = 'Ngày kết thúc không được trước ngày bắt đầu.';
  return errors;
}

const dayText = (days) => {
  if (days.length === 7) return 'Mọi ngày trong tuần';
  const numbered = days.filter((day) => day !== 7).map((day) => day + 1);
  if (!numbered.length) return 'Chủ nhật';
  return `Thứ ${numbered.join(', ')}${days.includes(7) ? ' và Chủ nhật' : ''}`;
};

/** Nhịp lặp bằng chữ: "Mỗi ngày", "Thứ 2, 4, 6 hằng tuần", "Mỗi 2 tuần: Thứ 2", "Ngày 5 hằng tháng". */
export function scheduleRepeatLabel(item) {
  if (item.frequency === 'DAILY') return 'Mỗi ngày';
  if (item.frequency === 'MONTHLY') return item.dayOfMonth ? `Ngày ${item.dayOfMonth} hằng tháng` : 'Chưa chọn ngày trong tháng';
  const days = daysOf(item);
  if (!days.length) return 'Chưa chọn thứ trong tuần';
  return Number(item.intervalWeeks) > 1 ? `Mỗi ${item.intervalWeeks} tuần: ${dayText(days)}` : `${dayText(days)} hằng tuần`;
}

const dmy = (iso) => iso.split('-').reverse().join('/');

/** Khoảng ngày bằng chữ ("Từ 16/11/2026 đến 31/01/2027"); rỗng khi không đặt ngày nào. */
export function scheduleRangeLabel(item) {
  if (item.startDate && item.endDate) return `Từ ${dmy(item.startDate)} đến ${dmy(item.endDate)}`;
  if (item.startDate) return `Từ ${dmy(item.startDate)}`;
  if (item.endDate) return `Đến ${dmy(item.endDate)}`;
  return '';
}
