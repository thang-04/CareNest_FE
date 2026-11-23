import { stepOfField } from '@/models/children/healthExamForm';

// Lỗi lưu nháp không có ô trên bước đang mở (ngày khám do BE ghi, lỗi chung `_form`) ⇒ liệt kê ở khung đỏ đầu phiếu, giữ câu BE.
export const unshownErrors = (errors, step) =>
  Object.entries(errors || {})
    .filter(([key, text]) => text && (key === 'date' || key === '_form' || stepOfField(key) !== step))
    .map(([, text]) => String(text));
