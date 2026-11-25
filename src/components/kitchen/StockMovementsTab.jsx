import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, EmptyState, ErrorState, LoadingState, Pagination, SearchSelect, SelectField } from '@/components';
import { DayBandRow } from '@/components/kitchen/DayBandRow';
import { KbOptionalDateFilter } from '@/components/kitchen/KitchenFilters';
import { StockMovementBadge } from '@/components/kitchen/KitchenBadges';
import { useDryFoods, useMovements } from '@/hooks/kitchen/useDryStock';
import { useDayGroupToggle } from '@/hooks/kitchen/useDayGroupToggle';
import { STOCK_MOVEMENT_LABELS, STOCK_MOVEMENT_TYPES } from '@/models/kitchen/kitchenConstants';
import { groupMovementsByDay, personName } from '@/utils/kitchen/stockLots';
import { formatStockChange } from '@/utils/kitchen/stockUnits';
import { formatDateTime } from '@/utils/format';

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
  const days = useDayGroupToggle(filtered);
  const result = movements.data;
  const items = useMemo(() => result?.items || [], [result]);
  const groups = useMemo(() => groupMovementsByDay(items), [items]);
  // Cột trống cả trang thì ẩn cho bảng gọn
  const showReason = items.some((m) => m.reason || m.receiptId);
  const showPerson = items.some((m) => personName(m.createdBy));
  const columns = 5 + (showReason ? 1 : 0) + (showPerson ? 1 : 0);

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
                <th>Thực phẩm</th>
                <th className="center">Lô</th>
                <th className="center">Loại</th>
                <th className="num">Số lượng</th>
                <th className="center">Ghi lúc</th>
                {showReason && <th className="center">Lý do</th>}
                {showPerson && <th>Người thực hiện</th>}
              </tr>
            </thead>
            {groups.map((group, i) => {
              const open = days.isOpen(group.key, i);
              return (
                <tbody key={group.key}>
                  <DayBandRow
                    colSpan={columns}
                    label={group.label}
                    count={group.items.length}
                    open={open}
                    onToggle={() => days.toggle(group.key)}
                  />
                  {open &&
                    group.items.map((m) => (
                      <tr key={m.id}>
                        <td className="fw-600">{m.food?.name}</td>
                        <td className="nowrap center">{m.lotNo}</td>
                        <td className="center">
                          <StockMovementBadge status={m.type} />
                        </td>
                        <td className={`num nowrap ${Number(m.quantity) < 0 ? 'kb-short' : 'kb-gain'}`}>
                          {formatStockChange(m.quantity, m.food)}
                        </td>
                        <td className="nowrap center">{formatDateTime(m.createdAt)}</td>
                        {showReason && (
                          <td className="kb-cell-wrap center">
                            {m.receiptId && (
                              <Link to={`/kitchen/stock-receipts/${m.receiptId}`} className="kb-block">
                                Xem phiếu nhập
                              </Link>
                            )}
                            {m.reason || (!m.receiptId && <span className="muted">—</span>)}
                          </td>
                        )}
                        {showPerson && <td>{personName(m.createdBy) || <span className="muted">—</span>}</td>}
                      </tr>
                    ))}
                </tbody>
              );
            })}
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
        <KbOptionalDateFilter label="Từ ngày" value={filters.from} max={filters.to} onChange={(from) => change({ from })} />
        <KbOptionalDateFilter label="Đến ngày" value={filters.to} min={filters.from} onChange={(to) => change({ to })} />
        <label className="date-filter">
          Loại
          <SelectField value={filters.type} onChange={(e) => change({ type: e.target.value })}>
            <option value="">Tất cả</option>
            {STOCK_MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {STOCK_MOVEMENT_LABELS[type]}
              </option>
            ))}
          </SelectField>
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
        <Button disabled={!filtered} onClick={() => change(NO_FILTER)}>
          Đặt lại bộ lọc
        </Button>
      </div>
      {body}
    </section>
  );
}
