import { X } from '@/components/ui/icons';

/**
 * Dòng tóm tắt dưới thanh lọc khi đang lọc: "N kết quả" + chip từng bộ lọc, bấm × bỏ bộ lọc đó.
 * chips: [{ key, label, onRemove }]. Không có chip nào ⇒ không hiện (chân phân trang đã có tổng).
 */
export function FilterChips({ count, unit = 'kết quả', chips = [] }) {
  if (!chips.length) return null;
  return (
    <div className="filter-summary" role="status" aria-live="polite">
      {count != null && (
        <span className="filter-summary__count">
          {count} {unit}
        </span>
      )}
      {chips.map((chip) => (
        <button key={chip.key} type="button" className="filter-chip" onClick={chip.onRemove} aria-label={`Bỏ lọc: ${chip.label}`}>
          {chip.label}
          <X size={12} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
