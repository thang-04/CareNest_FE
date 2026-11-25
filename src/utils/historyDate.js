/**
 * Lớp chỉ còn xem lịch sử (GV hết phân công): ngày xem không được sau ngày cuối còn quyền đọc của lớp đó.
 * Ngày đang chọn từ lớp khác vượt quá ⇒ dùng ngày cuối được xem; lớp đang dạy giữ nguyên ngày đã chọn.
 */
export const readableClassDate = (cls, date) => {
  if (!cls?.historicalReadOnly) return date || undefined;
  const last = cls.lastReadableDate;
  if (!last) return date || undefined;
  return date && date <= last ? date : last;
};
