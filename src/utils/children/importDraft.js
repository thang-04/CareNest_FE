// Bản xem trước nhập Excel chỉ giữ trong bộ nhớ trang (user chốt 14/11/2026): F5 hoặc đóng tab là mất, không lưu dữ liệu trẻ vào trình duyệt.
let draft = null;

export const saveImportDraft = (next) => {
  draft = next;
};
export const peekImportDraft = () => draft;
export const clearImportDraft = () => {
  draft = null;
};
