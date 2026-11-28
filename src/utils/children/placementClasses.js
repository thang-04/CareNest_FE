/**
 * Thẻ lớp ở Xếp lớp, Tiếp nhận (G94-180/CHD-14): chỉ so các số BE trả, không tự tính sĩ số.
 * occupiedCount = trẻ ở lớp từ ngày chọn (đang học + hẹn vào), đúng số BE dùng khi kiểm sức chứa.
 */
export function classFullness(c) {
  const occupied = c?.occupiedCount ?? c?.enrolledCount ?? 0;
  const arriving = Math.max(0, occupied - (c?.enrolledCount ?? 0));
  const full = c?.capacity != null && occupied >= c.capacity;
  return { arriving, full };
}
