// Khóa lỗi gắn với một ô trên phiếu (mọi bước); còn lại (`date` do BE ghi, `_form`, khóa lạ) chỉ hiện ở khung đỏ đầu phiếu.
const isFieldKey = (key) => /^(heightCm|weightKg|headCircumferenceCm|reason)$/.test(key) || /^exam\./.test(key);

// Lỗi không có ô trên bất kỳ bước nào ⇒ khung đỏ đầu phiếu, giữ câu BE, bỏ trùng.
export const unshownErrors = (errors) => [
  ...new Set(
    Object.entries(errors || {})
      .filter(([key, text]) => text && !isFieldKey(key))
      .map(([, text]) => String(text)),
  ),
];

// Lưu nháp thành công chỉ xóa lỗi không gắn ô; dấu lỗi kiểm tra ở các ô (từ "Lưu kết luận") được giữ.
export const withoutUnshownErrors = (errors) => Object.fromEntries(Object.entries(errors || {}).filter(([key]) => isFieldKey(key)));
