import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowDownUp,
  ArrowUpRight,
  CalendarX,
  ClipboardList,
  History,
  Hourglass,
  Package,
  PackageX,
  Plus,
  X,
} from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useDryStock, useDryStockItem } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { canManageStock } from '@/utils/kitchen/kitchenPermissions';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime } from '@/utils/format';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/kitchen.css';

const FILTERS = [
  { key: 'all', label: 'Tất cả', test: () => true },
  { key: 'out', label: 'Hết hàng', test: (f) => Object.values(f.byCampus).some((c) => c.status === 'OUT') },
  { key: 'low', label: 'Dưới 3 ngày', test: (f) => Object.values(f.byCampus).some((c) => c.status === 'LOW') },
  { key: 'exp', label: 'Sắp hết hạn', test: (f) => Object.values(f.byCampus).some((c) => c.expiring) },
];
const TX_ICON = { IN: ArrowDownLeft, OUT: ArrowUpRight, RETURN: ArrowDownLeft, ADJUST: ClipboardList };
const sum = (o) => Object.values(o).reduce((n, v) => n + v, 0);

function StockCell({ cell, unit }) {
  const tone = cell.status === 'OUT' ? 'danger' : cell.status === 'LOW' ? 'warn' : null;
  return (
    <span className="kb-stock-cell">
      <span className="nowrap">
        {fmtQty(cell.qty)} {unit}
      </span>
      <span className="muted">·</span>
      {tone ? (
        <span className="kb-buy">
          <span className={`kb-dot kb-dot--${tone}`} aria-hidden="true" />
          <b>{cell.status === 'OUT' ? 'Hết' : `${cell.daysLeft} ngày`}</b>
        </span>
      ) : (
        <span className="muted">{cell.daysLeft == null ? '—' : `${cell.daysLeft} ngày`}</span>
      )}
    </span>
  );
}

function TxList({ rows }) {
  if (!rows.length) return <p className="muted text-sm">Chưa có giao dịch.</p>;
  return (
    <ul className="kb-list">
      {rows.map((t, i) => {
        const Icon = TX_ICON[t.type] || ArrowDownUp;
        return (
          <li key={`${t.at}-${i}`} className="kb-list__item">
            <span className="kb-list__icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <div className="kb-list__main">
              <b>{t.label}</b>
              <small>
                {[
                  t.code,
                  t.supplierName,
                  t.quantity != null ? `${t.quantity > 0 ? '+' : '−'}${fmtQty(Math.abs(t.quantity))} ${t.unit}` : `${t.items} thực phẩm`,
                  t.amount ? formatMoney(t.amount) : null,
                  formatDateTime(t.at),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </small>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Panel phải: lô còn trong kho từng cơ sở (lô, hạn, giá, NCC) và giao dịch của thực phẩm. */
function LotPanel({ foodId, onClose }) {
  const { data, loading, error, reload } = useDryStockItem(foodId);
  return (
    <section className="card kb-panel">
      <div className="card__header">
        <h2 className="card__title">
          <Package size={18} /> {data?.name || 'Thực phẩm'}
        </h2>
        <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <div className="card__body kb-stack">
        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <>
            {data.campuses.map((c) => (
              <div key={c.id}>
                <div className="subsection-title">
                  {c.name} · tồn {fmtQty(c.qty)} {data.unit}
                  {c.qty > 0 && c.daysLeft != null ? ` · đủ ${c.daysLeft} ngày` : ''}
                </div>
                {c.lots.length === 0 ? (
                  <p className="muted text-sm">Hết hàng.</p>
                ) : (
                  c.lots.map((l, i) => (
                    <div key={`${l.receiptCode}-${i}`} className="kb-lot">
                      <b>
                        {l.lotNo ? `Lô ${l.lotNo}` : 'Tồn đầu kỳ (chưa ghi lô)'} · {fmtQty(l.qty)} {data.unit}
                      </b>
                      <span className="muted text-sm">
                        {[
                          l.expiryDate ? `Hạn ${formatDate(l.expiryDate)}` : null,
                          l.unitPrice != null ? `${formatMoney(l.unitPrice)}/${data.unit}` : null,
                          l.supplierName || null,
                          l.receivedDate ? `nhập ${formatDate(l.receivedDate).slice(0, 5)}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </div>
                  ))
                )}
                {c.canWrite && (
                  <Link className="btn btn--sm mt-8" to={`/kitchen/stock-receipts/new?campusId=${c.id}&foodId=${data.foodId}`}>
                    <Plus size={15} /> Nhập cho {c.name}
                  </Link>
                )}
              </div>
            ))}
            <div>
              <div className="subsection-title">Giao dịch của thực phẩm này</div>
              <TxList rows={data.transactions} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Kho khô (khảo sát 18/10/2026, S4; bố cục B): một bảng, mỗi cơ sở một cột (tồn · đủ dùng), sắp theo mức gấp; 4 ô số, lọc
 * nhanh, panel lô bên phải. Tồn tách theo cơ sở, không chuyển hàng giữa cơ sở. Số liệu do service tính.
 */
export default function DryStockPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useDryStock();
  const [filter, setFilter] = useState('all');
  // Mở sẵn panel của dòng gấp nhất; bấm đóng thì giữ đóng
  const [picked, setOpenId] = useState(undefined);

  if (loading && !data)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );

  const openId = picked === undefined ? data?.foods[0]?.foodId || null : picked;
  const k = data?.kpis;
  const rows = data ? data.foods.filter(FILTERS.find((f) => f.key === filter).test) : [];
  const byCampus = (o) => data.campuses.map((c) => `${c.name}: ${o[c.id] || 0}`).join(' · ');

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.dryStock)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Kho khô</h1>
          <p className="page__desc">
            Tồn đồ khô của hai cơ sở. Hàng không chuyển giữa cơ sở; "đủ dùng" tính theo lượng xuất trung bình 7 ngày.
          </p>
        </div>
        <div className="page__actions">
          <Link className="btn" to={KITCHEN_PAGES.stockCounts.to}>
            <ClipboardList size={16} /> Kiểm kê
          </Link>
          {canManageStock(user) && (
            <Link className="btn btn--primary" to="/kitchen/stock-receipts/new">
              <Plus size={16} /> Tạo phiếu nhập
            </Link>
          )}
        </div>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data.foods.length ? (
        <section className="card">
          <EmptyState title="Kho chưa có thực phẩm khô" description="Tạo phiếu nhập đầu tiên." />
        </section>
      ) : (
        <div className="kb-stack">
          <div className="kb-kpis">
            <div className="kb-kpi kb-kpi--danger">
              <span className="kb-kpi__icon" aria-hidden="true">
                <PackageX size={18} />
              </span>
              <div>
                <b>{sum(k.out)}</b>
                <span>Hết hàng</span>
                <small>{byCampus(k.out)}</small>
              </div>
            </div>
            <div className="kb-kpi kb-kpi--warn">
              <span className="kb-kpi__icon" aria-hidden="true">
                <Hourglass size={18} />
              </span>
              <div>
                <b>{sum(k.low)}</b>
                <span>Đủ dưới 3 ngày</span>
                <small>{byCampus(k.low)}</small>
              </div>
            </div>
            <div className="kb-kpi kb-kpi--warn">
              <span className="kb-kpi__icon" aria-hidden="true">
                <CalendarX size={18} />
              </span>
              <div>
                <b>{k.expiring.length}</b>
                <span>Hết hạn trong 14 ngày</span>
                <small>{k.expiring.slice(0, 2).join(', ') || '—'}</small>
              </div>
            </div>
            <div className="kb-kpi">
              <span className="kb-kpi__icon" aria-hidden="true">
                <ArrowDownUp size={18} />
              </span>
              <div>
                <b>
                  {k.lastIssue
                    ? new Date(k.lastIssue.at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false })
                    : '—'}
                </b>
                <span>Xuất tự động gần nhất</span>
                <small>{k.lastIssue ? `${k.lastIssue.code} · ${formatDate(k.lastIssue.at.slice(0, 10))}` : 'Chưa có'}</small>
              </div>
            </div>
          </div>
          <div className="kb-filters" role="group" aria-label="Lọc thực phẩm">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`chip ${filter === f.key ? 'chip--blue' : ''}`}
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label} · {data.foods.filter(f.test).length}
              </button>
            ))}
            <span className="text-sm muted kb-filters__end">Sắp theo mức gấp</span>
          </div>
          <div className={`kb-split ${openId ? 'kb-split--panel' : 'kb-split--full'}`}>
            <div className="kb-stack">
              <section className="card">
                <div className="table-wrap">
                  <table className="table table--compact kb-fc">
                    <thead>
                      <tr>
                        <th>Thực phẩm</th>
                        {data.campuses.map((c) => (
                          <th key={c.id}>
                            {c.name}
                            <small>tồn · đủ dùng</small>
                          </th>
                        ))}
                        <th>Hạn gần nhất</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={data.campuses.length + 2} className="muted text-sm">
                            Không có thực phẩm khớp bộ lọc.
                          </td>
                        </tr>
                      ) : (
                        rows.map((f) => {
                          const expiring = Object.values(f.byCampus).some((c) => c.expiring);
                          return (
                            <tr
                              key={f.foodId}
                              className={`row-click ${openId === f.foodId ? 'row--selected' : ''}`}
                              tabIndex={0}
                              aria-selected={openId === f.foodId}
                              onClick={() => setOpenId(f.foodId)}
                              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpenId(f.foodId))}
                            >
                              <td className="fw-600">{f.name}</td>
                              {data.campuses.map((c) => (
                                <td key={c.id}>
                                  <StockCell cell={f.byCampus[c.id]} unit={f.unit} />
                                </td>
                              ))}
                              <td>
                                {f.nearestExpiry ? (
                                  expiring ? (
                                    <span className="kb-buy">
                                      <span className="kb-dot kb-dot--warn" aria-hidden="true" />
                                      <b>{formatDate(f.nearestExpiry)}</b>
                                    </span>
                                  ) : (
                                    <span className="muted">{formatDate(f.nearestExpiry)}</span>
                                  )
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="card">
                <div className="card__header">
                  <h2 className="card__title">
                    <History size={18} /> Giao dịch gần đây · cả hai cơ sở
                  </h2>
                </div>
                <div className="card__body">
                  <TxList rows={data.transactions} />
                </div>
              </section>
            </div>
            {openId && <LotPanel foodId={openId} onClose={() => setOpenId(null)} />}
          </div>
        </div>
      )}
    </div>
  );
}
