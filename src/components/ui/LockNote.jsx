import { AlertTriangle, Hourglass, Lock } from './icons';

const ICONS = { notYet: Hourglass, overdue: AlertTriangle, locked: Lock };

/**
 * Dòng lý do dưới tên mục khi có quyền nhưng chưa thao tác được: chưa đến hạn (notYet), quá hạn (overdue), đã khóa (locked).
 * Ghi đủ lý do và cách xử lý; giờ/hạn lấy từ dữ liệu BE, không tự tính. Nút đi kèm giữ tên hành động và dùng disabledReason.
 *
 * <LockNote kind="overdue">Quá hạn 08:30 — chờ Hiệu trưởng mở lại điểm danh</LockNote>
 */
export function LockNote({ kind = 'locked', children, className = '' }) {
  const Icon = ICONS[kind] || Lock;
  return (
    <p className={['lock-note', `lock-note--${kind}`, className].filter(Boolean).join(' ')}>
      <Icon size={14} aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
