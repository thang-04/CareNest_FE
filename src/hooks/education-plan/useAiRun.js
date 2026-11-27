import { useRef } from 'react';

/**
 * Nút Hủy của lượt chờ AI: yêu cầu đã gửi vẫn chạy ở máy chủ (vẫn tính lượt), web chỉ bỏ kết quả. `begin()` trả hàm cho
 * biết lượt này còn hiệu lực; `cancel()` hoặc một lượt mới làm lượt cũ hết hiệu lực.
 */
export function useAiRun() {
  const ticket = useRef(0);
  return {
    begin: () => {
      const mine = ++ticket.current;
      return () => mine === ticket.current;
    },
    cancel: () => {
      ticket.current += 1;
    },
  };
}
