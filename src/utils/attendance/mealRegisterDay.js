/**
 * NUT-02: sổ ngày đã qua mà chưa xác nhận thì không xác nhận được nữa (BE chỉ cho xác nhận lại sổ đang chờ sau khi mở
 * lại điểm danh), nên màn chỉ còn cho xem.
 */
export const isPastUnconfirmed = (counts = [], today) =>
  counts.length > 0 &&
  counts[0].date < today &&
  !counts.some((count) => count.needsReconfirmation) &&
  counts.some((count) => count.status !== 'CONFIRMED');
