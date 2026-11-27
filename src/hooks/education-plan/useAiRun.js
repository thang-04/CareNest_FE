import { useRef, useSyncExternalStore } from 'react';

// Sau Hủy, mọi nút AI khóa 2 giây để không bấm dồn lượt mới (Tiền 28/11/2026)
export const AI_COOLDOWN_MS = 2000;
let cooling = false;
let timer = null;
const listeners = new Set();
const setCooling = (value) => {
  cooling = value;
  listeners.forEach((notify) => notify());
};
export function startAiCooldown() {
  clearTimeout(timer);
  setCooling(true);
  timer = setTimeout(() => setCooling(false), AI_COOLDOWN_MS);
}
export const isAiCooling = () => cooling;
const subscribe = (notify) => {
  listeners.add(notify);
  return () => listeners.delete(notify);
};

/**
 * Nút Hủy của lượt chờ AI: yêu cầu đã gửi vẫn chạy ở máy chủ (vẫn tính lượt), web chỉ bỏ kết quả. `begin()` trả hàm cho
 * biết lượt này còn hiệu lực; `cancel()` hoặc một lượt mới làm lượt cũ hết hiệu lực. `cooling`: đang khóa sau Hủy.
 */
export function useAiRun() {
  const ticket = useRef(0);
  return {
    cooling: useSyncExternalStore(subscribe, isAiCooling, isAiCooling),
    begin: () => {
      const mine = ++ticket.current;
      return () => mine === ticket.current;
    },
    cancel: () => {
      ticket.current += 1;
      startAiCooldown();
    },
  };
}
