import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, ShoppingBasket } from '@/components/ui/icons';
import { Breadcrumb, EmptyState, ErrorState, LoadingState } from '@/components';
import { FreshForecastCreateModal } from '@/components/kitchen/FreshForecastCreateModal';
import { KbCampusFilter } from '@/components/kitchen/KitchenFilters';
import { useCanManageStock } from '@/hooks/kitchen/useDryStock';
import { useFreshForecasts } from '@/hooks/kitchen/useFreshGoods';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { clickableRowProps } from '@/utils/clickableRow';
import { formatDate, formatDateTime } from '@/utils/format';

/** Các bản dự trù đã lưu của một điểm trường, mới nhất trước; mở một bản để xem, in hoặc xóa. */
export function FreshForecastList({ campus, autoOpen = false }) {
  const navigate = useNavigate();
  const canManage = useCanManageStock();
  const forecasts = useFreshForecasts(campus.campusId);
  // autoOpen: vào từ đường dẫn /forecast/new ⇒ mở sẵn hộp lập bản dự trù
  const [creating, setCreating] = useState(autoOpen && canManage);
  const listPath = `/kitchen/forecast?campusId=${campus.campusId}`;
  const closeCreate = () => {
    setCreating(false);
    if (autoOpen) navigate(listPath, { replace: true });
  };
  const create = (
    <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>
      <Plus size={16} /> Lập bản dự trù
    </button>
  );

  let body;
  if (forecasts.error) body = <ErrorState error={forecasts.error} onRetry={forecasts.reload} />;
  else if (forecasts.loading || !forecasts.data) body = <LoadingState />;
  else if (!forecasts.data.length)
    body = (
      <EmptyState
        title="Chưa có bản dự trù"
        description="Lập bản dự trù cho một kỳ để biết cần đặt bao nhiêu hàng tươi và làm căn cứ kiểm nhận lần 1."
        action={canManage && create}
      />
    );
  else
    body = (
      <div className="table-wrap">
        <table className="table table--grid">
          <thead>
            <tr>
              <th>Kỳ dự trù</th>
              <th>Ghi chú</th>
              <th className="num">Số thực phẩm</th>
              <th>Ngày lập</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.data.map((f) => (
              <tr
                key={f.id}
                className="row-click"
                {...clickableRowProps(() => navigate(`/kitchen/forecast/${f.id}?campusId=${campus.campusId}`))}
              >
                <td className="fw-600 text-primary nowrap">
                  {formatDate(f.periodFrom)} – {formatDate(f.periodTo)}
                </td>
                <td>{f.note || <span className="muted">—</span>}</td>
                <td className="num">{f.foodCount}</td>
                <td className="nowrap">{formatDateTime(f.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={kitchenCrumbs(KITCHEN_PAGES.forecast)} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Bản dự trù</h1>
        </div>
      </div>
      <div className="kb-toolbar">
        <KbCampusFilter campusId={campus.campusId} onChange={campus.setCampusId} canPick={campus.canPick} />
        <div className="kb-toolbar__end">
          <Link className="btn" to={`/kitchen/market-day?campusId=${campus.campusId}`}>
            <ShoppingBasket size={16} /> Đi chợ theo ngày
          </Link>
          {canManage && create}
        </div>
      </div>
      <section className="card">{body}</section>
      {creating && (
        <FreshForecastCreateModal
          campusId={campus.campusId}
          onClose={closeCreate}
          onSaved={(id) => navigate(`/kitchen/forecast/${id}?campusId=${campus.campusId}`, { replace: true })}
        />
      )}
    </div>
  );
}
