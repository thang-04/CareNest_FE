import { clickableRowProps } from '@/utils/clickableRow';
import { Pagination, paginate } from './Pagination';
import { EmptyState, ErrorState, SkeletonRows } from './States';

/**
 * Bảng danh sách chuẩn: gói sẵn khung `table--grid`, trạng thái đang tải / trống / lỗi và phân trang,
 * để mỗi màn không tự ráp lại (và không quên một trạng thái).
 *
 * columns: [{ key, header, className?, render?: (row) => node }] — `className` áp cho cả th và td (center, num, cell--actions…).
 * empty:   props của EmptyState ({ title, description, action }).
 * Phân trang phía client: truyền page + onPageChange (+ pageSize, unit); bỏ trống ⇒ hiện mọi dòng.
 *
 * <DataTable columns={columns} rows={data} loading={loading} error={error} onRetry={reload}
 *   empty={{ title: 'Chưa có nhà cung cấp nào' }} onRowClick={open} page={page} onPageChange={setPage} unit="nhà cung cấp" />
 */
export function DataTable({
  columns,
  rows,
  rowKey = 'id',
  loading = false,
  error,
  onRetry,
  empty,
  onRowClick,
  page,
  onPageChange,
  pageSize,
  unit,
  className = '',
}) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  const list = rows || [];
  const paged = onPageChange != null;
  const lastPage = Math.max(1, Math.ceil(list.length / (pageSize || list.length || 1)));
  const safePage = Math.min(page || 1, lastPage);
  const visible = paged ? paginate(list, safePage, pageSize) : list;
  const keyOf = typeof rowKey === 'function' ? rowKey : (row) => row[rowKey];

  return (
    <>
      <div className="table-wrap">
        <table className={`table table--grid ${className}`.trim()}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.className}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && !rows ? (
              <SkeletonRows rows={5} cols={columns.length} />
            ) : list.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <EmptyState {...empty} />
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr
                  key={keyOf(row)}
                  className={onRowClick ? 'row-click' : undefined}
                  {...(onRowClick ? clickableRowProps(() => onRowClick(row)) : {})}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={col.className}>
                      {col.render ? col.render(row) : (row[col.key] ?? <span className="muted">—</span>)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {paged && !loading && list.length > 0 && (
        <Pagination page={safePage} total={list.length} onChange={onPageChange} pageSize={pageSize} unit={unit} />
      )}
    </>
  );
}
