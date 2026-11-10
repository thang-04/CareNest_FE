import { useEffect, useRef } from 'react';

export const POLL_INTERVAL_MS = 20000;

/**
 * Gọi `refresh` định kỳ khi tab đang hiển thị, gọi ngay khi quay lại tab / có mạng lại; dừng khi tab ẩn.
 * Dùng cho dữ liệu người khác thay đổi (hàng chờ duyệt) mà không cần tải lại trang (BE spec 002 FR-001).
 */
export function usePolling(refresh, { interval = POLL_INTERVAL_MS, enabled = true } = {}) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return undefined;
    let timer = null;
    const visible = () => document.visibilityState === 'visible';
    const tick = () => {
      if (visible()) refreshRef.current();
    };
    const start = () => {
      clearInterval(timer);
      timer = visible() ? setInterval(tick, interval) : null;
    };
    const onWake = () => {
      tick();
      start();
    };
    start();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('online', onWake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('online', onWake);
    };
  }, [interval, enabled]);
}
