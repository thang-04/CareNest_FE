import { createContext, useContext, useLayoutEffect } from 'react';

export const READ_ONLY_REASON = 'Bạn chỉ có quyền xem mục này. Muốn sửa, hãy nhờ Hiệu trưởng giao việc ở màn Phân công Phó hiệu trưởng.';
/** Lý do chung khi màn tự biết người dùng chỉ có quyền xem (cờ quyền BE), không qua AreaGate. */
export const VIEW_ONLY_REASON = 'Bạn chỉ có quyền xem mục này. Cần sửa: nhờ Hiệu trưởng cấp quyền.';

/** Trạng thái chỉ xem của cả màn do AreaGate cấp (theo quyền BE của PHT). */
export const PageReadOnlyContext = createContext(null);

/**
 * Đọc trạng thái chỉ xem và nhận việc hiển thị nhãn: màn gọi hook này phải tự hiện `ReadOnlyTag`
 * (PageHeader đã làm sẵn), khi đó AreaGate bỏ dải chữ dự phòng. `reason` dùng cho `Button disabledReason`.
 */
export function usePageReadOnly() {
  const ctx = useContext(PageReadOnlyContext);
  const claim = ctx?.claim;
  useLayoutEffect(() => (claim ? claim() : undefined), [claim]);
  return { readOnly: !!ctx?.readOnly, reason: ctx?.reason || VIEW_ONLY_REASON };
}
