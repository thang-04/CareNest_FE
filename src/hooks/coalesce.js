/**
 * Gộp nhiều lần gọi liền nhau thành một lần chạy sau `ms` (lần gọi cuối thắng). Dùng cho tải lại khi "dữ liệu đổi":
 * dữ liệu giả tự bổ sung khi đọc có thể ghi hàng chục lần trong một lượt, mỗi lần ghi mà tải lại cả màn sẽ làm nghẽn mạng.
 */
export function coalesce(fn, ms) {
  let timer = null;
  return {
    trigger: () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, ms);
    },
    cancel: () => clearTimeout(timer),
  };
}
