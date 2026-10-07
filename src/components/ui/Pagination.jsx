import { ChevronLeft, ChevronRight } from 'lucide-react';

export const DEFAULT_PAGE_SIZE = 8;

/** Returns the items of one page. */
export const paginate = (items, page, pageSize = DEFAULT_PAGE_SIZE) => items.slice((page - 1) * pageSize, page * pageSize);

/**
 * Footer of every list table.
 * <Pagination page={page} total={items.length} onChange={setPage} unit="phiếu" />
 */
export function Pagination({ page, total, onChange, pageSize = DEFAULT_PAGE_SIZE, unit = 'mục' }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="row row--between pagination">
      <span className="muted">
        Hiển thị {total ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} / {total} {unit}
      </span>
      <div className="row" style={{ gap: 4 }}>
        <button className="icon-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Trang trước">
          <ChevronLeft size={18} />
        </button>
        {Array.from({ length: pages }).map((_, i) => (
          <button
            key={i}
            className={`page-btn ${page === i + 1 ? 'page-btn--active' : ''}`}
            onClick={() => onChange(i + 1)}
            aria-current={page === i + 1 ? 'page' : undefined}
          >
            {i + 1}
          </button>
        ))}
        <button className="icon-btn" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Trang sau">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
