import { Link } from 'react-router-dom';
import { Plus } from '@/components/ui/icons';
import { EmptyState, ErrorState, LoadingState } from '@/components';
import { useCanManageStock, useShortfalls } from '@/hooks/kitchen/useDryStock';
import { formatPurchaseQty } from '@/utils/kitchen/stockUnits';
import { formatDate } from '@/utils/format';

/** Phần thiếu chờ bổ sung của một điểm trường: thực phẩm kho chưa đủ để trừ theo số suất. */
export function StockShortfallsTab({ campusId }) {
  const canManage = useCanManageStock();
  const shortfalls = useShortfalls(campusId);

  let body;
  if (shortfalls.error) body = <ErrorState error={shortfalls.error} onRetry={shortfalls.reload} />;
  else if (shortfalls.loading || !shortfalls.data) body = <LoadingState />;
  else if (!shortfalls.data.length)
    body = <EmptyState title="Không có phần thiếu" description="Kho đủ thực phẩm cho các ngày đã trừ theo số suất." />;
  else
    body = (
      <div className="table-wrap">
        <table className="table table--grid">
          <thead>
            <tr>
              <th>Ngày ăn</th>
              <th>Thực phẩm</th>
              <th className="num">Cần dùng</th>
              <th className="num">Đang thiếu</th>
              {canManage && (
                <th className="center">
                  <span className="sr-only">Nhập bổ sung</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {shortfalls.data.map((row) => (
              <tr key={`${row.mealDate}-${row.food?.id}`}>
                <td className="nowrap">{formatDate(row.mealDate)}</td>
                <td className="fw-600">{row.food?.name}</td>
                <td className="num nowrap">{formatPurchaseQty(row.requiredQty, row.food)}</td>
                <td className="num nowrap kb-short">{formatPurchaseQty(row.shortfallQty, row.food)}</td>
                {canManage && (
                  <td className="center">
                    <Link className="btn btn--sm" to={`/kitchen/stock-receipts/new?campusId=${campusId}&foodId=${row.food?.id}`}>
                      <Plus size={14} /> Nhập bổ sung
                    </Link>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return <section className="card">{body}</section>;
}
