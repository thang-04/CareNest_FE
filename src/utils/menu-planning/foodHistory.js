import {
  FOOD_GROUP_LABELS,
  FOOD_ORIGIN_LABELS,
  FOOD_STORAGE_LABELS,
  RECORD_STATUS_LABELS,
} from '@/models/menu-planning/menuPlanningConstants';

// Trường lưu giá trị mã (enum BE) ⇒ nhãn hiển thị; trường còn lại hiển thị nguyên giá trị
const LABELS_BY_FIELD = {
  'Nhóm thực phẩm': FOOD_GROUP_LABELS,
  'Bảo quản': FOOD_STORAGE_LABELS,
  'Nguồn gốc': FOOD_ORIGIN_LABELS,
  'Trạng thái': RECORD_STATUS_LABELS,
};

/** Giá trị trước/sau của lịch sử thực phẩm ⇒ chữ hiển thị; trống ⇒ '—'. */
export const foodHistoryValue = (field, value) => {
  if (value == null || value === '') return '—';
  if (field === 'Đơn giá') return `${Number(value).toLocaleString('vi-VN')} đ`;
  if (field === 'Chất gây dị ứng') return String(value);
  return LABELS_BY_FIELD[field]?.[value] || String(value);
};

/** Một dòng lịch sử BE ⇒ dạng HistoryCard: người, lúc, hành động, trường đổi kèm trước/sau và ghi chú. */
export const toFoodHistoryEntry = (h, index) => ({
  // Dòng đổi giá lấy từ lịch sử giá không có id riêng ⇒ khóa theo vị trí
  id: `food-history-${index}`,
  userId: h.userId,
  at: h.at,
  action: h.action,
  field: h.field || '',
  oldValue: h.field ? foodHistoryValue(h.field, h.oldValue) : '',
  newValue: h.field ? foodHistoryValue(h.field, h.newValue) : '',
  note: h.note || '',
});
