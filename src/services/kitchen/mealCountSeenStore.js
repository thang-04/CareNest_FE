/*
 * Lần bếp xem số suất gần nhất theo điểm trường/ngày/bữa, lưu trên máy (thay thông báo khi chưa có module thông báo).
 * Chỉ là tiện ích hiển thị nhãn "Mới": bộ nhớ trình duyệt bị chặn thì coi như chưa xem.
 */
const KEY = 'carenest.kitchen.seenMealCounts';

export const readSeenMealCounts = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};

export const saveSeenMealCounts = (seen) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    /* bộ nhớ trình duyệt bị chặn: chỉ mất nhãn "Mới" */
  }
};
