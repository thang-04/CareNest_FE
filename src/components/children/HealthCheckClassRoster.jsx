import { Link } from 'react-router-dom';
import { FileText, HeartPulse, Stethoscope, X, Users } from '@/components/ui/icons';
import { useHealthCheckClass } from '@/hooks/children/useHealthChecks';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { ChildResultBadge, ConclusionCategoryBadge, FollowUpDueBadge, FollowUpLevelShortBadge } from './ChildBadges';
import { CHILD_RESULT_STATUS } from '@/models/children/healthCheckConstants';
import { MEASUREMENT_SOURCE, MEASUREMENT_SOURCE_LABELS } from '@/models/children/childrenConstants';
import { formatDate } from '@/utils/format';

const COLS = 6;

/** Kết luận rút gọn BE trả: chuyên khoa được chuyển hoặc lời dặn. */
const conclusionNote = (c) => (c?.specialty ? `Chuyển khám: ${c.specialty}` : c?.adviceText ? `Lời dặn: ${c.adviceText}` : '');

/** Danh sách trẻ của một lớp trong đợt khám; giáo viên phụ trách lớp mở phiếu khám Phụ lục II từng trẻ khi đợt đang diễn ra. */
export function HealthCheckClassRoster({ campaignId, classId, onClose }) {
  const { roster, loading, error, reload } = useHealthCheckClass(campaignId, classId);
  const rows = roster?.children || [];
  const concluded = rows.filter((r) => r.result === CHILD_RESULT_STATUS.RECORDED).length;
  const examLink = (childId) => `/children/health-checks/${campaignId}/exam/${childId}?classId=${classId}`;

  return (
    <section className="card mt-16" aria-label={roster ? `Danh sách trẻ ${roster.cls.name}` : 'Danh sách trẻ của lớp'}>
      <div className="card__header row row--between row--wrap gap-2">
        <h2 className="card__title">
          {roster ? `${roster.cls.name} – đã có kết luận ${concluded}/${rows.length} trẻ` : 'Danh sách trẻ của lớp'}
        </h2>
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
                <th>Phiếu khám</th>
                <th>Kết luận</th>
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
                rows.map((r) => {
                  const legacy = r.source === MEASUREMENT_SOURCE.LEGACY;
                  const hasExam = !!r.measurementId && !legacy;
                  return (
                    <tr key={r.childId}>
                      <td>
                        <div className="fw-600">{r.fullName}</div>
                        <div className="muted text-xs">{r.code}</div>
                        {/* Trẻ đang có phiếu theo dõi: người nhập và bác sĩ khám biết để chú ý (user chốt 2026-10-16). */}
                        {r.followUp && (
                          <div className="tr-cell-stack mt-8">
                            <Link className="text-primary text-xs" to={`/children/health-follow-ups/${r.followUp.id}`}>
                              Đang có phiếu theo dõi
                            </Link>
                            <FollowUpDueBadge dueOn={r.followUp.dueOn} overdueDays={r.followUp.overdueDays} hideOnTime />
                            {r.followUp.latestExternalResult && (
                              <span className="muted text-xs tr-note">Bác sĩ chuyên khoa: {r.followUp.latestExternalResult.note}</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <ChildResultBadge status={r.result} />
                        {r.date && <div className="muted text-xs mt-8">Ngày khám {formatDate(r.date)}</div>}
                        {legacy && <div className="muted text-xs">{MEASUREMENT_SOURCE_LABELS.LEGACY}</div>}
                      </td>
                      <td>
                        {r.conclusionCategory ? (
                          <div className="tr-cell-stack">
                            <ConclusionCategoryBadge status={r.conclusionCategory} />
                            {conclusionNote(r.conclusion) && <span className="muted text-xs tr-note">{conclusionNote(r.conclusion)}</span>}
                          </div>
                        ) : r.followUpLevel ? (
                          <FollowUpLevelShortBadge status={r.followUpLevel} />
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="text-sm">
                        {r.previous ? (
                          <div className="tr-cell-stack">
                            <span className="muted text-xs">{formatDate(r.previous.date)}</span>
                            <FollowUpLevelShortBadge status={r.previous.followUpLevel} />
                            {conclusionNote(r.previous.conclusion) && (
                              <span className="muted text-xs tr-note">{conclusionNote(r.previous.conclusion)}</span>
                            )}
                          </div>
                        ) : (
                          <span className="muted">Chưa có</span>
                        )}
                      </td>
                      <td>
                        {r.result !== CHILD_RESULT_STATUS.RECORDED ? (
                          <span className="muted">—</span>
                        ) : r.published ? (
                          <span className="chip chip--green">Đã công bố</span>
                        ) : (
                          <span className="chip chip--gray">Chưa công bố</span>
                        )}
                      </td>
                      <td className="center nowrap">
                        {roster.canRecord && r.result === CHILD_RESULT_STATUS.NOT_RECORDED && (
                          <Link className="btn btn--primary btn--sm" to={examLink(r.childId)}>
                            <Stethoscope size={14} /> Khám
                          </Link>
                        )}
                        {roster.canRecord && r.result === CHILD_RESULT_STATUS.IN_PROGRESS && (
                          <Link className="btn btn--sm" to={examLink(r.childId)}>
                            <Stethoscope size={14} /> Tiếp tục khám
                          </Link>
                        )}
                        {hasExam && !(roster.canRecord && r.result === CHILD_RESULT_STATUS.IN_PROGRESS) && (
                          <Link
                            className="icon-btn"
                            to={examLink(r.childId)}
                            title="Xem phiếu khám"
                            aria-label={`Xem phiếu khám của ${r.fullName}`}
                          >
                            <FileText size={17} />
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
