/** Ô chọn tệp chuẩn (dùng trong FormField để có nhãn, lỗi); `accept` giới hạn đuôi tệp ở hộp chọn của trình duyệt. */
export function FileInput(props) {
  return <input type="file" {...props} />;
}
