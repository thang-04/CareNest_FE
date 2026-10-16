import { Link } from 'react-router-dom';
import { HeartPulse, Pencil, Plus, X, Users } from '@/components/ui/icons';
import { useHealthCheckClass } from '@/hooks/children/useHealthChecks';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { ChildResultBadge, FollowUpLevelShortBadge } from './ChildBadges';
import { formatDate } from '@/utils/format';

const COLS = 6;

/** Danh sách trẻ của một lớp trong đợt khám, kèm nút nhập/sửa kết quả khi đợt đang diễn ra (giáo viên phụ trách lớp). */
export function HealthCheckClassRoster({ campaignId, classId, onClose }) {
  const { roster, loading, error, reload } = useHealthCheckClass(campaignId, classId);
  const rows = roster?.children || [];
  const recorded = rows.filter((r) => r.measurementId).length;
  const query = `campaignId=${campaignId}&classId=${classId}`;

  return (
    <section className="card mt-16" aria-label={roster ? `Danh sách trẻ ${roster.cls.name}` : 'Danh sách trẻ của lớp'}>
      <div className="card__header row row--between row--wrap gap-2">
        <h2 className="card__title">{roster ? `${roster.cls.name} – đã nhập ${recorded}/${rows.length} trẻ` : 'Danh sách trẻ của lớp'}</h2>
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Đóng danh sách trẻ của lớp" title="Đóng">
            <X size={17} />
          </button>
        )}
      </div>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <div className="table-wrap tr-table-flat">
          <table className="table">
            <thead>
              <tr>
                <th>Trẻ</th>
                <th>Kết quả</th>
                <th>Mức theo dõi</th>
                <th>Lần khám trước</th>
                <th>Phụ huynh</th>
                <th className="center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows rows={4} cols={COLS} />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={COLS}>
                    <EmptyState icon={Users} title="Lớp chưa có trẻ trong đợt này" description="Trẻ đang học của lớp sẽ hiện ở đây." />
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.childId}>
                    <td>
                      <div className="fw-600">{r.fullName}</div>
                      <div className="muted text-xs">{r.code}</div>
                    </td>
                    <td>
                      <ChildResultBadge status={r.result} />
                      {r.date && <div className="muted text-xs mt-8">Ngày đo {formatDate(r.date)}</div>}
                    </td>
                    <td>{r.followUpLevel ? <FollowUpLevelShortBadge status={r.followUpLevel} /> : <span className="muted">—</span>}</td>
                    <td className="text-sm">
                      {r.previous ? (
                        <div className="tr-cell-stack">
                          <span className="muted text-xs">{formatDate(r.previous.date)}</span>
                          <FollowUpLevelShortBadge status={r.previous.followUpLevel} />
                        </div>
                      ) : (
                        <span className="muted">Chưa có</span>
                      )}
                    </td>
                    <td>
                      {!r.measurementId ? (
                        <span className="muted">—</span>
                      ) : r.published ? (
                        <span className="chip chip--green">Đã công bố</span>
                      ) : (
                        <span className="chip chip--gray">Chưa công bố</span>
                      )}
                    </td>
                    <td className="center nowrap">
                      {roster.canRecord && !r.measurementId && (
                        <Link className="btn btn--primary btn--sm" to={`/children/${r.childId}/health/new?${query}`}>
                          <Plus size={14} /> Nhập kết quả
                        </Link>
                      )}
                      {roster.canRecord && r.measurementId && (
                        <Link
                          className="icon-btn"
                          to={`/children/${r.childId}/health/${r.measurementId}/edit?${query}`}
                          title="Sửa kết quả khám"
                          aria-label={`Sửa kết quả khám của ${r.fullName}`}
                        >
                          <Pencil size={17} />
                        </Link>
                      )}
                      <Link
                        className="icon-btn"
                        to={`/children/${r.childId}/health`}
                        title="Mở sổ sức khỏe"
                        aria-label={`Mở sổ sức khỏe của ${r.fullName}`}
                      >
                        <HeartPulse size={17} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
