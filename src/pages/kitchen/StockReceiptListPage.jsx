import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, PackagePlus, Search, Warehouse } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useStock, useStockReceipts } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, EmptyState, ErrorState, Modal, Pagination, SkeletonRows, paginate } from '@/components';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { canManageStock } from '@/utils/kitchen/kitchenPermissions';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime, normalizeText } from '@/utils/format';
import '@/styles/modules/kitchen.css';

const TABS = [
  { key: 'stock', label: 'Tồn kho hiện tại' },
  { key: 'receipts', label: 'Phiếu nhập kho' },
];

function StockTab({ campusId }) {
  const { stock, loading, error, reload } = useStock(campusId);
  const [keyword, setKeyword] = useState('');
  const rows = useMemo(() => stock.filter((s) => normalizeText(s.name).includes(normalizeText(keyword))), [stock, keyword]);
  return (
    <>
      <div className="filter-bar">
        <label className="search-box" style={{ flex: 1 }}>
          <Search size={17} className="muted" />
          <input placeholder="Tìm thực phẩm..." value={keyword} onChange={(e) => setKeyword(e.target.value)} aria-label="Tìm thực phẩm" />
        </label>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Thực phẩm</th>
                <th>Đơn vị</th>
                <th className="right">Tồn kho</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={5} cols={4} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState icon={Warehouse} title="Không có thực phẩm phù hợp" description="Thử từ khóa khác." />
                  </td>
                </tr>
              ) : (
                rows.map((s) => (
                  <tr key={s.foodId}>
                    <td className="fw-600">{s.name}</td>
                    <td>{s.unit}</td>
                    <td className="right">{fmtQty(s.quantity)}</td>
                    <td>{s.quantity <= 0 ? <span className="chip chip--red">Hết hàng</span> : null}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ReceiptDetail({ receipt, md, onClose }) {
  return (
    <Modal
      open={!!receipt}
      title={receipt ? `Phiếu nhập kho ${receipt.code}` : ''}
      size="lg"
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose}>
          Đóng
        </button>
      }
    >
      {receipt && (
        <>
          <dl className="info-list mb-16">
            <dt>Ngày nhập</dt>
            <dd>{formatDate(receipt.date)}</dd>
            <dt>Người ghi nhận</dt>
            <dd>
              {md.userById(receipt.createdBy)?.fullName || '—'} · {formatDateTime(receipt.createdAt)}
            </dd>
            {receipt.note && (
              <>
                <dt>Ghi chú</dt>
                <dd>{receipt.note}</dd>
              </>
            )}
          </dl>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Thực phẩm</th>
                  <th className="right">Nhận</th>
                  <th className="right">Không đạt</th>
                  <th className="right">Nhập kho</th>
                  <th>Hạn sử dụng</th>
                  <th>Ghi chú kiểm tra</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((it) => (
                  <tr key={it.foodId}>
                    <td>{it.name}</td>
                    <td className="right nowrap">
                      {fmtQty(it.receivedQty)} {it.unit}
                    </td>
                    <td className={`right nowrap ${it.rejectedQty > 0 ? 'kb-short' : ''}`}>{fmtQty(it.rejectedQty)}</td>
                    <td className="right nowrap fw-600">{fmtQty(it.acceptedQty)}</td>
                    <td>{it.expiryDate ? formatDate(it.expiryDate) : '—'}</td>
                    <td className="kb-cell-wrap">{it.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Modal>
  );
}

function ReceiptsTab({ campusId, md }) {
  const { receipts, loading, error, reload } = useStockReceipts(campusId);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const pageRows = paginate(receipts, page);
  return (
    <>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Ngày nhập</th>
                <th className="right">Số thực phẩm</th>
                <th>Kiểm tra chất lượng</th>
                <th>Người ghi nhận</th>
                <th className="center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={4} cols={6} />
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={PackagePlus}
                      title="Chưa có phiếu nhập kho"
                      description="Ghi nhận thực phẩm nhận từ nhà cung cấp để cập nhật tồn kho."
                      action={
                        <Link className="btn btn--primary" to="/kitchen/stock-receipts/new">
                          <PackagePlus size={16} /> Nhập kho thực phẩm
                        </Link>
                      }
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => {
                  const rejected = r.items.filter((it) => it.rejectedQty > 0).length;
                  return (
                    <tr key={r.id} className="row-click" onClick={() => setOpen(r)}>
                      <td className="fw-600 text-primary">{r.code}</td>
                      <td>{formatDate(r.date)}</td>
                      <td className="right">{r.items.length}</td>
                      <td>
                        {rejected ? (
                          <span className="chip chip--red">{rejected} thực phẩm không đạt một phần</span>
                        ) : (
                          <span className="chip chip--green">Đạt</span>
                        )}
                      </td>
                      <td>{md.userById(r.createdBy)?.fullName || '—'}</td>
                      <td className="center" onClick={(e) => e.stopPropagation()}>
                        <button className="icon-btn" onClick={() => setOpen(r)} title="Xem phiếu" aria-label={`Xem phiếu ${r.code}`}>
                          <Eye size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      {!loading && receipts.length > 0 && <Pagination page={page} total={receipts.length} onChange={setPage} unit="phiếu" />}
      <ReceiptDetail receipt={open} md={md} onClose={() => setOpen(null)} />
    </>
  );
}

/** Screen #90 – Food Stock Receipt (UC 6.23): campus stock and the deliveries recorded by the Vice Principal. */
export default function StockReceiptListPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'receipts' ? 'receipts' : 'stock';
  const campusId = user?.campusId;
  const campus = md.campusById(campusId);

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.stockReceipts)} />
      <div className="page__head">
        <h1 className="page__title">Nhập kho thực phẩm</h1>
        {canManageStock(user) && (
          <button className="btn btn--primary btn--lg" onClick={() => navigate('/kitchen/stock-receipts/new')}>
            <PackagePlus size={18} /> Nhập kho thực phẩm
          </button>
        )}
      </div>
      <p className="muted mb-16">
        Kho thực phẩm {campus ? `của ${campus.shortName || campus.name}` : ''}. Số lượng không đạt chất lượng được ghi trên phiếu nhưng
        không cộng vào tồn kho.
      </p>
      <div className="card">
        <div className="tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              className={`tab ${tab === t.key ? 'tab--active' : ''}`}
              onClick={() => setParams(t.key === 'stock' ? {} : { tab: t.key }, { replace: true })}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'stock' ? <StockTab campusId={campusId} /> : <ReceiptsTab campusId={campusId} md={md} />}
      </div>
    </div>
  );
}
