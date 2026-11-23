import { ChevronDown } from '@/components/ui/icons';

/** Khối thu gọn của một lớp (giáo viên nhiều lớp): details/summary gốc nên bàn phím và đọc màn hình dùng được. */
export function RosterFold({ summary, open, onToggle, label, children }) {
  return (
    <details className="card mt-16 tr-roster-fold" open={open} onToggle={(e) => onToggle(e.currentTarget.open)} aria-label={label}>
      <summary className="tr-roster-fold__summary">
        <ChevronDown size={16} className="tr-roster-fold__chevron" aria-hidden="true" />
        <span className="card__title">{summary}</span>
      </summary>
      {open && children}
    </details>
  );
}
