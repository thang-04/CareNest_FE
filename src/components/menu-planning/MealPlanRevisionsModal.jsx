import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { MealDayChanges } from '@/components/menu-planning/MealDayChanges';
import { useMealPlanRevisions } from '@/hooks/menu-planning/useMealPlan';
import { weekLabel } from '@/models/menu-planning/menuPlanningConstants';
import { dayLabel } from '@/utils/menu-planning/menuChecks';
import { formatDateTime } from '@/utils/format';

/** Lịch sử sửa ngoại lệ của tuần đã công bố (BE trả, mới nhất trước): ngày, người sửa, lúc sửa, lý do, món đổi, ghi chú đổi. */
export function MealPlanRevisionsModal({ week, onClose }) {
  const q = useMealPlanRevisions(week, true);
  const revisions = q.data || [];
  return (
    <Modal open size="lg" title={`Lịch sử sửa thực đơn · ${weekLabel(week)}`} onClose={onClose}>
      {q.error ? (
        <ErrorState error={q.error} onRetry={q.reload} />
      ) : q.loading ? (
        <LoadingState />
      ) : !revisions.length ? (
        <EmptyState title="Chưa có lần sửa nào" description="Tuần này chưa được sửa sau khi công bố." />
      ) : (
        <ol className="td-revisions">
          {revisions.map((r) => (
            <li key={r.id} className="td-revision">
              <div className="td-revision__head">
                <strong>{dayLabel(r.menuDate)}</strong>
                <span className="text-sm muted">
                  {r.changedByName || 'Không rõ người sửa'} · {formatDateTime(r.changedAt)}
                </span>
                {r.issues?.length > 0 && <span className="chip chip--orange">{r.issues.length} lưu ý cân đối lúc sửa</span>}
              </div>
              <p className="td-revision__reason">
                <span className="muted">Lý do: </span>
                {r.reason}
              </p>
              <MealDayChanges beforeItems={r.before?.items} afterItems={r.after?.items} emptyText="Không đổi món." />
              {(r.before?.note || '') !== (r.after?.note || '') && (
                <p className="text-sm td-flat">
                  <span className="muted">Ghi chú: </span>
                  <del className="muted">{r.before?.note || 'Trống'}</del> → {r.after?.note || 'Trống'}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
