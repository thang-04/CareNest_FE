import { ChevronLeft, ChevronRight } from '@/components/ui/icons';

export const DEFAULT_PAGE_SIZE = 8;

/** Returns the items of one page. */
export const paginate = (items, page, pageSize = DEFAULT_PAGE_SIZE) => items.slice((page - 1) * pageSize, page * pageSize);

/** Nút số trang: nhiều trang thì chỉ hiện trang đầu, cuối, quanh trang hiện tại; null = dấu … (không tràn ngang). */
const pageItems = (page, pages) => {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const out = [];
  [...keep]
    .sort((a, b) => a - b)
    .forEach((p, i, list) => {
      if (i && p - list[i - 1] > 1) out.push(null);
      out.push(p);
    });
  return out;
};

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
      <div className="row gap-1">
        <button className="icon-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Trang trước">
          <ChevronLeft size={18} />
        </button>
        {pageItems(page, pages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="muted" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              className={`page-btn ${page === p ? 'page-btn--active' : ''}`}
              onClick={() => onChange(p)}
              aria-current={page === p ? 'page' : undefined}
            >
              {p}
            </button>
          ),
        )}
        <button className="icon-btn" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Trang sau">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
