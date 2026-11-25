import { useLocation } from 'react-router-dom';

/** Router state gắn vào link mở phiếu nhập: nhớ màn hình (đường dẫn + điểm trường/bộ lọc trên URL) để quay về sau khi xác nhận. */
export const useReceiptOrigin = () => {
  const { pathname, search } = useLocation();
  return { from: `${pathname}${search}` };
};

/** Màn nguồn hợp lệ (chỉ đường dẫn nội bộ của bếp); không có hoặc lạ ⇒ null. */
export const receiptOriginOf = (state) => (typeof state?.from === 'string' && state.from.startsWith('/kitchen/') ? state.from : null);
