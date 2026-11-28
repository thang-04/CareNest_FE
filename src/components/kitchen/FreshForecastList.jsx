import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from '@/components/ui/icons';
import { Button, DataTable, EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from '@/components';
import { usePageReadOnly } from '@/contexts/PageReadOnlyContext';
import { FreshForecastCreateModal } from '@/components/kitchen/FreshForecastCreateModal';
import { KbCampusFilter } from '@/components/kitchen/KitchenFilters';
import { useCanManageStock } from '@/hooks/kitchen/useDryStock';
import { useFreshForecasts } from '@/hooks/kitchen/useFreshGoods';
import { kitchenCrumbs, KITCHEN_PAGES } from '@/utils/kitchen/breadcrumbs';
import { formatDate, formatDateTime } from '@/utils/format';

/** Các bản dự trù đã lưu của một điểm trường, mới nhất trước; mở một bản để xem, in hoặc xóa. */
export function FreshForecastList({ campus, autoOpen = false }) {
  const navigate = useNavigate();
  const canManage = useCanManageStock(campus.campusId);
  const { reason: viewOnlyReason } = usePageReadOnly();
  const forecasts = useFreshForecasts(campus.campusId);
  // autoOpen: vào từ đường dẫn /forecast/new ⇒ mở sẵn hộp lập bản dự trù
  const [creating, setCreating] = useState(autoOpen && canManage);
  const listPath = `/kitchen/forecast?campusId=${campus.campusId}`;
  const closeCreate = () => {
    setCreating(false);
    if (autoOpen) navigate(listPath, { replace: true });
  };
  const create = (
    <Button variant="primary" icon={Plus} onClick={() => setCreating(true)} disabledReason={canManage ? undefined : viewOnlyReason}>
      Lập bản dự trù
    </Button>
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
      <DataTable
        rows={forecasts.data}
        onRowClick={(f) => navigate(`/kitchen/forecast/${f.id}?campusId=${campus.campusId}`)}
        columns={[
          {
            key: 'period',
            header: 'Kỳ dự trù',
            className: 'fw-600 text-primary nowrap center',
            render: (f) => `${formatDate(f.periodFrom)} – ${formatDate(f.periodTo)}`,
          },
          { key: 'version', header: 'Bản', className: 'nowrap center', render: (f) => (f.version == null ? '—' : `Bản ${f.version}`) },
          {
            key: 'status',
            header: 'Trạng thái',
            className: 'nowrap center',
            // BE cũ chưa trả `current` thì không đoán trạng thái
            render: (f) => {
              if (f.current == null) return <span className="muted">—</span>;
              return f.current ? (
                <StatusBadge tone="green" label="Đang dùng cho kiểm nhận" size="sm" />
              ) : (
                <StatusBadge tone="gray" label="Đã thay thế" size="sm" />
              );
            },
          },
          { key: 'note', header: 'Ghi chú', render: (f) => f.note || <span className="muted">—</span> },
          { key: 'foodCount', header: 'Số mặt hàng', className: 'num' },
          { key: 'createdAt', header: 'Ngày lập', className: 'nowrap center', render: (f) => formatDateTime(f.createdAt) },
        ]}
      />
    );

  return (
    <div className="page">
      <PageHeader crumbs={kitchenCrumbs(KITCHEN_PAGES.forecast)} title="Bản dự trù" readOnly={!canManage} />
      <div className="kb-toolbar">
        <KbCampusFilter campusId={campus.campusId} onChange={campus.setCampusId} canPick={campus.canPick} />
        <div className="kb-toolbar__end">{create}</div>
      </div>
      <section className="card">{body}</section>
      {creating && (
        <FreshForecastCreateModal
          campusId={campus.campusId}
          existing={forecasts.data || []}
          onClose={closeCreate}
          onSaved={(id) => navigate(`/kitchen/forecast/${id}?campusId=${campus.campusId}`, { replace: true })}
        />
      )}
    </div>
  );
}
