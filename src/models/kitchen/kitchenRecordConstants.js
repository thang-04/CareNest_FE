/*
 * Bếp hôm nay, lưu mẫu thức ăn, ảnh bữa trên BE (`/nutrition/kitchen/day`, `/food-samples`, `/meal-photos`).
 * Mã trạng thái theo BE; ở đây chỉ có nhãn hiển thị.
 */
export { MEAL_SESSION_LABELS } from '@/models/mealSessions';

// Thứ tự phục vụ trong ngày
export const MEAL_SESSION_ORDER = ['MORNING', 'LUNCH', 'AFTERNOON'];
export const MEAL_BLOCK_ORDER = ['NURSERY', 'KINDERGARTEN'];
export const MEAL_BLOCK_LABELS = { NURSERY: 'Nhà trẻ', KINDERGARTEN: 'Mẫu giáo' };

export const KITCHEN_MENU_STATUS_LABELS = { NONE: 'Chưa lập thực đơn', DRAFT: 'Bản nháp', PUBLISHED: 'Đã công bố' };
export const KITCHEN_COUNT_STATUS_LABELS = {
  NONE: 'Chưa có suất đã xác nhận',
  PARTIAL: 'Mới xác nhận một số bữa',
  CONFIRMED: 'Đã xác nhận',
};
export const FOOD_STORAGE_LABELS = { FRESH: 'Hàng tươi', DRY: 'Hàng khô' };

export const SAMPLE_STATUS_LABELS = { RECORDED: 'Chờ duyệt lưu mẫu', APPROVED: 'Đã duyệt lưu mẫu' };
export const SAMPLE_DISPOSAL_LABELS = { NONE: 'Chưa ghi hủy', RECORDED: 'Chờ duyệt hủy mẫu', APPROVED: 'Đã duyệt hủy mẫu' };

export const KITCHEN_RECORD_PAGES = {
  today: { label: 'Bếp hôm nay', to: '/kitchen/published-menu' },
  inspections: { label: 'Kiểm thực ba bước', to: '/kitchen/inspections' },
  foodSamples: { label: 'Lưu mẫu thức ăn', to: '/kitchen/food-samples' },
  mealPhotos: { label: 'Ảnh bữa ăn', to: '/kitchen/meal-photos' },
  photoWindows: { label: 'Khung giờ đăng ảnh', to: '/kitchen/photo-windows' },
};
