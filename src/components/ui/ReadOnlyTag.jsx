import { Lock } from './icons';

/**
 * Nhãn "Chỉ xem" ở đầu trang khi người dùng không có quyền ghi trên màn. Chữ tĩnh, không bấm được;
 * lý do nằm ở bóng chữ của nút chính đang khóa (Button disabledReason). Thường không gọi trực tiếp: dùng prop readOnly
 * của PageHeader / ListPage.
 */
export function ReadOnlyTag() {
  return (
    <span className="readonly-tag">
      <Lock size={14} aria-hidden="true" />
      Chỉ xem
    </span>
  );
}
