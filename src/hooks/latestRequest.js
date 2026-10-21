/**
 * Đánh số từng lần tải: chỉ lần mới nhất (và khi component còn mount) được ghi state,
 * để response cũ về sau không ghi đè dữ liệu của filter mới.
 */
export function createLatestRequest() {
  let current = 0;
  let mounted = true;
  return {
    begin: () => ++current,
    isLatest: (id) => mounted && id === current,
    // Huỷ mọi lần đang chạy (vd. tắt `enabled`).
    cancel: () => {
      current += 1;
    },
    mount: () => {
      mounted = true;
    },
    unmount: () => {
      mounted = false;
      current += 1;
    },
  };
}
