import { Link, useNavigate } from 'react-router-dom';
import { Plus } from '@/components/ui/icons';
import { Breadcrumb, EmptyState, ErrorState, LoadingState, StatusBadge } from '@/components';
import { ReceiptStatusBadge } from '@/components/kitchen/KitchenBadges';
import { useStockReceipts } from '@/hooks/kitchen/useKitchen';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { clickableRowProps } from '@/utils/clickableRow';
import { formatDate } from '@/utils/format';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { RECEIPT_STATUS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

/** Danh sách phiếu nhập kho (BA Receipt List): phiếu nháp mở lại để sửa/xác nhận, phiếu đã xác nhận chỉ xem. */
export default function StockReceiptListPage() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useStockReceipts('');
  const open = (r) => navigate(`/kitchen/stock-receipts/${r.id}/edit`);

  let body;
  if (loading && !data) body = <LoadingState />;
  else if (error) body = <ErrorState error={error} onRetry={reload} />;
  else if (!data?.length)
    body = (
      <section className="card">
        <EmptyState
          title="Chưa có phiếu nhập kho"
          description="Tạo phiếu khi nhận hàng khô từ nhà cung cấp."
          action={
            <Link className="btn btn--primary" to="/kitchen/stock-receipts/new">
              <Plus size={16} /> Tạo phiếu nhập
            </Link>
          }
        />
      </section>
    );
  else
    body = (
      <section className="card">
        <div className="table-wrap">
          <table className="table table--grid">
            <thead>
              <tr>
                <th>Mã phiếu</th>
                <th>Ngày nhập</th>
                <th>Điểm trường</th>
                <th>Nhà cung cấp</th>
                <th className="num">Số thực phẩm</th>
                <th className="num">Tổng tiền</th>
                <th className="center">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="row-click" {...clickableRowProps(() => open(r))}>
                  <td className="fw-600 text-primary">{r.code}</td>
                  <td>{formatDate(r.date)}</td>
                  <td>{r.campusName}</td>
                  <td>
                    {r.supplierName || <span className="muted">Chưa chọn</span>}
                    {r.supplierName && !r.supplierId && (
                      <>
                        {' '}
                        <StatusBadge tone="gray" label="Chưa liên kết danh mục" />
                      </>
                    )}
                  </td>
                  <td className="num">{r.items.length}</td>
                  <td className="num nowrap">{formatMoney(r.totalAmount)}</td>
                  <td className="center">
                    <ReceiptStatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );

  const drafts = (data || []).filter((r) => r.status === RECEIPT_STATUS.DRAFT).length;
  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.stockReceipts)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Phiếu nhập kho</h1>
          <p className="page__desc">
            Phiếu nháp chưa cộng tồn; xác nhận nhập thì cộng tồn theo lô và khóa sửa.
            {drafts ? ` Đang có ${drafts} phiếu nháp.` : ''}
          </p>
        </div>
        <div className="page__actions">
          <Link className="btn btn--primary" to="/kitchen/stock-receipts/new">
            <Plus size={16} /> Tạo phiếu nhập
          </Link>
        </div>
      </div>
      {body}
    </div>
  );
}
