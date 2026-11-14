import { useAsync } from '@/hooks/useAsync';
import { getOverdueClasses } from '@/services/assessment/assessmentService';
import { OVERDUE_KIND_LABELS } from '@/models/assessment/evaluationLocks.mjs';
import { ErrorState, SkeletonRows } from '@/components/ui/States';
import { formatDate } from '@/utils/format';

/** BGH: lớp quá hạn chưa xong nhận xét tuần / đánh giá kỳ trong phạm vi (BE OBS-30); không có lớp nào thì ẩn. */
export function OverdueClassesCard({ user, campusLabel }) {
  const { data, loading, error, reload } = useAsync(() => getOverdueClasses({}, user), [user?.id]);
  if (!loading && !error && !data?.length) return null;
  return (
    <div className="card mb-16">
      <div className="card__header">
        <h2 className="card__title">Lớp quá hạn</h2>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Lớp</th>
                <th>Kỳ</th>
                <th>Hạn</th>
                <th className="num">Đã xong</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={2} cols={5} />
              ) : (
                data.map((r) => (
                  <tr key={`${r.kind}-${r.classId}-${r.periodKey}`}>
                    <td>{OVERDUE_KIND_LABELS[r.kind] || r.kind}</td>
                    <td className="fw-600">
                      {r.className}
                      {campusLabel && <div className="text-sm muted">{campusLabel(r.campusId)}</div>}
                    </td>
                    <td>{r.label}</td>
                    <td className="nowrap">{formatDate(r.deadline)}</td>
                    <td className="num">
                      {r.done}/{r.total}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
