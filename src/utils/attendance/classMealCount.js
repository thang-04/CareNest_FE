import { MEAL_SESSION_LABELS } from '@/models/attendance/attendanceConstants';
import { formatTime } from '@/utils/format';

/*
 * Thẻ "Suất ăn lớp hôm nay": đổi dữ liệu GET /meal-counts/class thành ô hiển thị từng bữa. Số suất và trạng thái lấy nguyên
 * từ BE (NUT-02, NUT-03); chỉ ánh xạ mã trạng thái sang chữ, tông màu, không cộng trừ lại.
 */
const STATUS_VIEW = {
  OPEN: { tone: 'blue', label: 'Đang nhận báo ăn', locked: false },
  PENDING_CONFIRMATION: { tone: 'purple', label: 'Chờ xác nhận', locked: false },
  CONFIRMED: { tone: 'green', label: 'Đã xác nhận', locked: true },
};

export const classMealRows = (data) =>
  (data?.meals || []).map((meal) => {
    const view = meal.needsReconfirmation
      ? { tone: 'red', label: 'Cần xác nhận lại', locked: false }
      : STATUS_VIEW[meal.status] || { tone: 'gray', label: 'Chưa có thông tin', locked: false };
    const confirmedAt = view.locked && meal.confirmedAt ? formatTime(meal.confirmedAt) : null;
    return {
      session: meal.session,
      title: MEAL_SESSION_LABELS[meal.session] || meal.session,
      normal: meal.normal,
      substitute: meal.substitute,
      tone: view.tone,
      status: confirmedAt ? `${view.label} lúc ${confirmedAt}` : view.label,
      locked: view.locked,
    };
  });
