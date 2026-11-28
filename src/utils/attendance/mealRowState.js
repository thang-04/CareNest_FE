/**
 * CHD-13: cờ "Báo ăn" là giá trị hiện tại của hồ sơ. Ngày đã khóa mà bản ghi có suất thì hiện suất đã lưu (SAVED),
 * không gắn "Không báo ăn" cho ngày trẻ đã được tính suất.
 */
export const mealRowState = (row, { editable, baseLocked } = {}) => {
  if (row.child.mealRegistered !== false) return 'REGISTERED';
  const saved = Object.values(row.record?.meals || {}).some(Boolean);
  return saved && (!editable || baseLocked) ? 'SAVED' : 'UNREGISTERED';
};
