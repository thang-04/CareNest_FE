import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from '@/components/ui/icons';
import { EmptyState, ErrorState, LoadingState } from '@/components';
import { KbOptionalDateFilter } from '@/components/kitchen/KitchenFilters';
import { ReceiptStatusBadge } from '@/components/kitchen/KitchenBadges';
import { useCanManageStock, useReceipts } from '@/hooks/kitchen/useDryStock';
import { RECEIPT_STATUS_LABELS } from '@/models/kitchen/kitchenConstants';
import { clickableRowProps } from '@/utils/clickableRow';
import { formatDate, formatMoney } from '@/utils/format';

/** Danh sách phiếu nhập kho của một điểm trường; mở phiếu để xem, sửa nháp, xác nhận hoặc hủy. */
export function StockReceiptsTab({ campusId }) {
  const navigate = useNavigate();
  const canManage = useCanManageStock();
  const [filters, setFilters] = useState({ status: '', from: '', to: '' });
  const receipts = useReceipts({ campusId, ...filters });
  const create = (
    <Link className="btn btn--primary" to={`/kitchen/stock-receipts/new?campusId=${campusId}`}>
      <Plus size={16} /> Lập phiếu nhập
    </Link>
  );

  let body;
  if (receipts.error) body = <ErrorState error={receipts.error} onRetry={receipts.reload} />;
  else if (receipts.loading || !receipts.data) body = <LoadingState />;
  else if (!receipts.data.length)
    body = (
      <EmptyState
        title="Chưa có phiếu nhập kho"
        description={
          filters.status || filters.from || filters.to ? 'Không có phiếu khớp bộ lọc.' : 'Lập phiếu khi nhận hàng khô từ nhà cung cấp.'
        }
        action={canManage && create}
      />
    );
  else
    body = (
      <div className="table-wrap">
        <table className="table table--grid">
          <thead>
            <tr>
              <th>Ngày nhập</th>
              <th>Nhà cung cấp</th>
              <th className="num">Số thực phẩm</th>
              <th className="money">Tổng tiền</th>
              <th className="center">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {receipts.data.map((r) => (
              <tr key={r.id} className="row-click" {...clickableRowProps(() => navigate(`/kitchen/stock-receipts/${r.id}`))}>
                <td className="fw-600 text-primary">{formatDate(r.receivedDate)}</td>
                <td>{r.supplierName}</td>
                <td className="num">{r.lines.length}</td>
                <td className="money nowrap">{formatMoney(r.totalValue)}</td>
                <td className="center">
                  <ReceiptStatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <section className="card">
      <div className="card__body kb-toolbar kb-toolbar--card">
        <label className="date-filter">
          Trạng thái
          <select className="select" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">Tất cả</option>
            {Object.entries(RECEIPT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <KbOptionalDateFilter label="Từ ngày" value={filters.from} onChange={(from) => setFilters((f) => ({ ...f, from }))} />
        <KbOptionalDateFilter label="Đến ngày" value={filters.to} onChange={(to) => setFilters((f) => ({ ...f, to }))} />
        <button
          type="button"
          className="btn"
          disabled={!filters.status && !filters.from && !filters.to}
          onClick={() => setFilters({ status: '', from: '', to: '' })}
        >
          Đặt lại bộ lọc
        </button>
      </div>
      {body}
    </section>
  );
}
