import { Filter } from '@/components/ui/icons';

/** Nút "Lọc thêm": gom bộ lọc phụ vào ô nổi để thanh lọc chính gọn; count = số bộ lọc phụ đang bật. */
export function FilterMore({ count = 0, children }) {
  return (
    <details className="filter-more">
      <summary className="btn">
        <Filter size={15} /> Lọc thêm{count > 0 && <span className="tab__count">{count}</span>}
      </summary>
      <div className="filter-more__panel">{children}</div>
    </details>
  );
}
