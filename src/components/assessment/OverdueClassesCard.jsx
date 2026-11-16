import { useAsync } from '@/hooks/useAsync';
import { getOverdueClasses } from '@/services/assessment/assessmentService';
import { OVERDUE_KIND_LABELS } from '@/models/assessment/evaluationLocks.mjs';
import { DataTable } from '@/components/ui/DataTable';
import { formatDate } from '@/utils/format';

/** BGH: lớp quá hạn chưa xong nhận xét tuần / đánh giá kỳ trong phạm vi (BE OBS-30); không có lớp nào thì ẩn. */
export function OverdueClassesCard({ user, campusLabel }) {
  const { data, loading, error, reload } = useAsync(() => getOverdueClasses({}, user), [user?.id]);
  if (!loading && !error && !data?.length) return null;
  const columns = [
    { key: 'kind', header: 'Loại', render: (r) => OVERDUE_KIND_LABELS[r.kind] || r.kind },
    {
      key: 'className',
      header: 'Lớp',
      className: 'fw-600',
      render: (r) => (
        <>
          {r.className}
          {campusLabel && <div className="text-sm muted">{campusLabel(r.campusId)}</div>}
        </>
      ),
    },
    { key: 'label', header: 'Kỳ' },
    { key: 'deadline', header: 'Hạn', className: 'nowrap', render: (r) => formatDate(r.deadline) },
    { key: 'done', header: 'Đã xong', className: 'num', render: (r) => `${r.done}/${r.total}` },
  ];
  return (
    <div className="card mb-16">
      <div className="card__header">
        <h2 className="card__title">Lớp quá hạn</h2>
      </div>
      <DataTable
        columns={columns}
        rows={data}
        rowKey={(r) => `${r.kind}-${r.classId}-${r.periodKey}`}
        loading={loading}
        error={error}
        onRetry={reload}
      />
    </div>
  );
}
