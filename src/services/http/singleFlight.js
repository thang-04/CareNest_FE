/**
 * Gộp các lần gọi trùng khi lần trước chưa xong: mọi caller nhận chung 1 promise.
 * Dùng cho logout khi nhiều request song song cùng nhận 401.
 */
export function singleFlight(fn) {
  let inFlight = null;
  return (...args) => {
    if (!inFlight) {
      inFlight = Promise.resolve()
        .then(() => fn(...args))
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  };
}
