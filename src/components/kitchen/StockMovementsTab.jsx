import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState, Pagination, SearchSelect } from '@/components';
import { KbOptionalDateFilter } from '@/components/kitchen/KitchenFilters';
import { StockMovementBadge } from '@/components/kitchen/KitchenBadges';
import { useDryFoods, useMovements } from '@/hooks/kitchen/useDryStock';
import { STOCK_MOVEMENT_LABELS, STOCK_MOVEMENT_TYPES } from '@/models/kitchen/kitchenConstants';
import { personName } from '@/utils/kitchen/stockLots';
import { formatSignedPurchaseQty } from '@/utils/kitchen/stockUnits';
import { formatDate, formatDateTime } from '@/utils/format';

const PAGE_SIZE = 50;
const NO_FILTER = { from: '', to: '', type: '', foodId: '' };

/** Lịch sử nhập/trừ kho khô của một điểm trường: số có dấu (+ vào lô, − ra khỏi lô), mới nhất trước. */
export function StockMovementsTab({ campusId }) {
  const [filters, setFilters] = useState(NO_FILTER);
  const [page, setPage] = useState(0);
  const { foods } = useDryFoods();
  const movements = useMovements({ campusId, ...filters, page, size: PAGE_SIZE });
  const foodOptions = useMemo(
    () => [{ value: '', label: 'Tất cả thực phẩm' }, ...foods.map((f) => ({ value: String(f.id), label: f.name }))],
    [foods],
  );
  // Đổi bộ lọc thì về trang đầu
  const change = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(0);
  };
  const filtered = Object.values(filters).some(Boolean);
  const result = movements.data;

  let body;
  if (movements.error) body = <ErrorState error={movements.error} onRetry={movements.reload} />;
  else if (movements.loading || !result) body = <LoadingState />;
  else if (!result.items.length)
    body = (
      <EmptyState
        title="Chưa có lịch sử nhập/trừ"
        description={filtered ? 'Không có dòng nào khớp bộ lọc.' : 'Nhập kho hoặc trừ kho theo số suất sẽ hiện ở đây.'}
      />
    );
  else
    body = (
      <>
        <div className="table-wrap">
          <table className="table table--grid">
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Loại</th>
                <th>Thực phẩm</th>
                <th>Lô</th>
                <th className="num">Số lượng</th>
                <th>Ngày ăn</th>
                <th>Lý do</th>
                <th>Người thực hiện</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((m) => (
                <tr key={m.id}>
                  <td className="nowrap">{formatDateTime(m.createdAt)}</td>
                  <td>
                    <StockMovementBadge status={m.type} />
                  </td>
                  <td className="fw-600">{m.food?.name}</td>
                  <td>{m.lotNo}</td>
                  <td className={`num nowrap fw-600 ${Number(m.quantity) < 0 ? 'kb-short' : ''}`}>
                    {formatSignedPurchaseQty(m.quantity, m.food)}
                  </td>
                  <td>{m.mealDate ? formatDate(m.mealDate) : <span className="muted">—</span>}</td>
                  <td className="kb-cell-wrap">
                    {m.receiptId && (
                      <Link to={`/kitchen/stock-receipts/${m.receiptId}`} className="kb-block">
                        Xem phiếu nhập
                      </Link>
                    )}
                    {m.reason || (!m.receiptId && <span className="muted">—</span>)}
                  </td>
                  <td>{personName(m.createdBy) || <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={result.page + 1}
          total={result.totalElements}
          pageSize={result.size || PAGE_SIZE}
          onChange={(p) => setPage(p - 1)}
          unit="dòng"
        />
      </>
    );

  return (
    <section className="card">
      <div className="card__body kb-toolbar kb-toolbar--card">
        <KbOptionalDateFilter label="Từ ngày" value={filters.from} onChange={(from) => change({ from })} />
        <KbOptionalDateFilter label="Đến ngày" value={filters.to} onChange={(to) => change({ to })} />
        <label className="date-filter">
          Loại
          <select className="select" value={filters.type} onChange={(e) => change({ type: e.target.value })}>
            <option value="">Tất cả</option>
            {STOCK_MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {STOCK_MOVEMENT_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <div className="field kb-field-food">
          <span className="field__label">Thực phẩm</span>
          <SearchSelect
            options={foodOptions}
            value={filters.foodId}
            onChange={(foodId) => change({ foodId })}
            ariaLabel="Lọc theo thực phẩm"
          />
        </div>
        <button type="button" className="btn" disabled={!filtered} onClick={() => change(NO_FILTER)}>
          Đặt lại bộ lọc
        </button>
      </div>
      {body}
    </section>
  );
}
