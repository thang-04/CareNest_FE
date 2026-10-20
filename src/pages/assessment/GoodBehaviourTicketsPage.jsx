import { useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Flag, Ticket } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAssessmentClasses, useTicketBoard } from '@/hooks/assessment/useAssessment';
import { issueTickets } from '@/services/assessment/assessmentService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { ChildAvatar } from '@/components/ChildAvatar';
import { TicketSummary } from '@/components/assessment/TicketSummary';
import { Tabs } from '@/components/ui/Tabs';
import { TicketOverview } from '@/components/assessment/TicketOverview';
import { canViewTicketOverview } from '@/utils/assessment/assessmentPermissions';
import { TicketBadge } from '@/components/assessment/AssessmentBadges';
import { TICKET_TYPE, TICKET_TYPE_LABELS } from '@/models/assessment/assessmentConstants';
import { formatDateTime } from '@/utils/format';
import { periodLabel } from '@/utils/assessment/assessmentPeriods';

// Tuần ghi như giáo án (Tuần N của năm học), tháng ghi Tháng mm/yyyy
const periodText = (pType, p) =>
  p.weekNo ? `Tuần ${p.weekNo} (${periodLabel(pType, p.start, p.end).replace(/^Tuần /, '')})` : periodLabel(pType, p.start, p.end);

/** Lý do chưa đủ điều kiện, nói rõ còn thiếu bao nhiêu (thay cho khung giải thích quy tắc). */
const missingText = (r, rules, weekly) => {
  if (!weekly) return `Thiếu ${rules.MONTH_MIN_WEEKLY_TICKETS - r.weeklyTickets} phiếu tuần`;
  const parts = [
    r.presentDays < rules.WEEK_MIN_PRESENT_DAYS && `thiếu ${rules.WEEK_MIN_PRESENT_DAYS - r.presentDays} ngày có mặt`,
    r.flagCount < rules.WEEK_MIN_FLAGS && `thiếu ${rules.WEEK_MIN_FLAGS - r.flagCount} cờ`,
  ].filter(Boolean);
  const text = parts.join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const SUMMARY = 'SUMMARY';

// Đủ điều kiện chưa phát lên đầu, rồi đã phát, cuối cùng chưa đủ điều kiện
const rank = (r) => (r.ticket ? 1 : r.eligible ? 0 : 2);
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** #60 Good Behaviour Tickets (UC 4.13, GBR-REW-01/02): the teacher issues tickets to eligible children; eligibility is rule-based. */
/** PHT / Hiệu trưởng: xem phiếu bé ngoan các lớp (chỉ xem, giáo viên lớp phát phiếu). */
function LeaderTicketsPage() {
  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.tickets)} />
      <h1 className="page__title">Phiếu bé ngoan các lớp</h1>
      <div className="card">
        <TicketOverview />
      </div>
    </div>
  );
}

export default function GoodBehaviourTicketsPage() {
  const { user } = useAuth();
  return canViewTicketOverview(user) ? <LeaderTicketsPage /> : <TeacherTicketsPage />;
}

function TeacherTicketsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { classes, loading: classesLoading, error: classesError } = useAssessmentClasses();
  const [classId, setClassId] = useState('');
  const [type, setType] = useState(TICKET_TYPE.WEEKLY);
  const [periodStart, setPeriodStart] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const currentClassId = classId || classes[0]?.id || '';
  // Tab "Tổng hợp": số phiếu bé ngoan theo trẻ (không tải bảng phát phiếu)
  const summaryView = type === SUMMARY;
  const params = useMemo(
    () => ({ classId: summaryView ? '' : currentClassId, type, periodStart: periodStart || undefined }),
    [summaryView, currentClassId, type, periodStart],
  );
  const { board, loading, error, reload } = useTicketBoard(params);

  const rows = [...(board?.rows || [])].sort((a, b) => rank(a) - rank(b) || a.child.fullName.localeCompare(b.child.fullName, 'vi'));
  const periods = board?.periods || [];
  const periodIndex = periods.findIndex((p) => p.start === board?.period?.start);
  // Giáo viên dạy một lớp: không cần chọn lớp
  const cls = classes.find((c) => c.id === currentClassId);
  const issuable = rows.filter((r) => r.eligible && !r.ticket);
  const issued = rows.filter((r) => r.ticket).length;
  const weekly = type === TICKET_TYPE.WEEKLY;
  const pType = weekly ? 'WEEK' : 'MONTH';

  const changeFilter = (fn) => {
    fn();
    setSelected(new Set());
  };
  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = issuable.length > 0 && issuable.every((r) => selected.has(r.child.id));

  const doIssue = async () => {
    try {
      const res = await issueTickets({ classId: currentClassId, type, periodStart: board.period.start, childIds: [...selected] }, user);
      toast.success(`Đã phát ${res.length} ${(TICKET_TYPE_LABELS[type] || '').toLowerCase()}. Phụ huynh đã được thông báo.`);
      setSelected(new Set());
      setConfirmOpen(false);
      reload({ silent: true });
    } catch (err) {
      toast.error(err, 'Chưa phát được phiếu');
      setConfirmOpen(false);
      reload({ silent: true });
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.tickets)} />
      <h1 className="page__title">Phiếu bé ngoan</h1>
      {classesError ? (
        <ErrorState error={classesError} />
      ) : !classesLoading && classes.length === 0 ? (
        <StatusPage kind="403" title="Bạn chưa được phân công lớp" description="Chỉ giáo viên của lớp mới phát phiếu bé ngoan." />
      ) : (
        <div className="card">
          <Tabs
            ariaLabel="Loại phiếu bé ngoan"
            items={[
              { key: TICKET_TYPE.WEEKLY, label: TICKET_TYPE_LABELS.WEEKLY },
              { key: TICKET_TYPE.MONTHLY, label: TICKET_TYPE_LABELS.MONTHLY },
              { key: SUMMARY, label: 'Tổng hợp' },
            ]}
            value={type}
            onChange={(t) =>
              changeFilter(() => {
                setType(t);
                setPeriodStart('');
              })
            }
          />
          {summaryView ? (
            <TicketSummary classId={currentClassId} />
          ) : (
            <>
              <div className="filter-bar dg-ticket-bar">
                {classes.length > 1 ? (
                  <select
                    className="select"
                    aria-label="Lớp"
                    value={currentClassId}
                    onChange={(e) =>
                      changeFilter(() => {
                        setClassId(e.target.value);
                        setPeriodStart('');
                      })
                    }
                  >
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  cls && <span className="fw-600">{cls.name}</span>
                )}
                <div className="dg-period-nav">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={weekly ? 'Tuần trước' : 'Tháng trước'}
                    title={weekly ? 'Tuần trước' : 'Tháng trước'}
                    disabled={periodIndex < 0 || periodIndex >= periods.length - 1}
                    onClick={() => changeFilter(() => setPeriodStart(periods[periodIndex + 1].start))}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <select
                    className="select"
                    aria-label={weekly ? 'Tuần đã kết thúc' : 'Tháng đã kết thúc'}
                    value={board?.period?.start || ''}
                    onChange={(e) => changeFilter(() => setPeriodStart(e.target.value))}
                    disabled={!periods.length}
                  >
                    {periods.map((p) => (
                      <option key={p.start} value={p.start}>
                        {periodText(pType, p)}
                        {p.themeName ? ` · ${p.themeName}` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={weekly ? 'Tuần sau' : 'Tháng sau'}
                    title={weekly ? 'Tuần sau' : 'Tháng sau'}
                    disabled={periodIndex <= 0}
                    onClick={() => changeFilter(() => setPeriodStart(periods[periodIndex - 1].start))}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="spacer" />
                {board?.period && (
                  <div className="dg-ticket-stats">
                    <TicketBadge status="ELIGIBLE" detail={`${rows.filter((r) => r.eligible).length}/${rows.length}`} />
                    <TicketBadge status="ISSUED" detail={issued} />
                    {issuable.length > 0 && <TicketBadge status="PENDING_ISSUE" detail={issuable.length} />}
                  </div>
                )}
              </div>
              {error ? (
                <ErrorState error={error} onRetry={reload} />
              ) : !loading && board && !board.period ? (
                <EmptyState
                  icon={CalendarRange}
                  title="Chưa có kỳ nào kết thúc"
                  description="Phiếu chỉ được phát sau khi tuần hoặc tháng kết thúc."
                />
              ) : (
                <div className="table-wrap">
                  <table className="table table--grid">
                    <thead>
                      <tr>
                        <th className="center dg-col-check">
                          <input
                            type="checkbox"
                            aria-label="Chọn tất cả trẻ đủ điều kiện"
                            checked={allSelected}
                            disabled={!issuable.length}
                            onChange={() => setSelected(allSelected ? new Set() : new Set(issuable.map((r) => r.child.id)))}
                          />
                        </th>
                        <th>Trẻ</th>
                        {weekly ? (
                          <>
                            <th className="num" title={`Cần ít nhất ${board?.rules?.WEEK_MIN_PRESENT_DAYS ?? 4} ngày`}>
                              Ngày có mặt <span className="muted">(cần {board?.rules?.WEEK_MIN_PRESENT_DAYS ?? 4})</span>
                            </th>
                            <th className="num" title={`Cần ít nhất ${board?.rules?.WEEK_MIN_FLAGS ?? 3} cờ`}>
                              Cờ bé ngoan <span className="muted">(cần {board?.rules?.WEEK_MIN_FLAGS ?? 3})</span>
                            </th>
                          </>
                        ) : (
                          <th className="num" title={`Cần ít nhất ${board?.rules?.MONTH_MIN_WEEKLY_TICKETS ?? 3} phiếu tuần`}>
                            Phiếu tuần trong tháng <span className="muted">(cần {board?.rules?.MONTH_MIN_WEEKLY_TICKETS ?? 3})</span>
                          </th>
                        )}
                        <th className="center">Điều kiện</th>
                        <th>Phiếu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading || classesLoading || !board ? (
                        <SkeletonRows rows={5} cols={weekly ? 6 : 5} />
                      ) : rows.length === 0 ? (
                        <tr>
                          <td colSpan={6}>
                            <EmptyState title="Lớp chưa có trẻ" />
                          </td>
                        </tr>
                      ) : (
                        rows.map((r) => (
                          <tr key={r.child.id}>
                            <td className="center">
                              <input
                                type="checkbox"
                                aria-label={`Chọn ${r.child.fullName}`}
                                checked={selected.has(r.child.id)}
                                disabled={!r.eligible || !!r.ticket}
                                onChange={() => toggle(r.child.id)}
                              />
                            </td>
                            <td>
                              <div className="dg-ticket-child">
                                <ChildAvatar child={r.child} size="sm" />
                                <div>
                                  <div className="fw-600">{r.child.fullName}</div>
                                  <div className="muted text-xs">{r.child.code}</div>
                                </div>
                              </div>
                            </td>
                            {weekly ? (
                              <>
                                <td className={`num ${r.presentDays < board.rules.WEEK_MIN_PRESENT_DAYS ? 'text-danger' : ''}`}>
                                  {r.presentDays}/5
                                </td>
                                <td className={`num ${r.flagCount < board.rules.WEEK_MIN_FLAGS ? 'text-danger' : ''}`}>
                                  <span className="dg-flag-count">
                                    <Flag size={14} aria-hidden="true" /> {r.flagCount}
                                  </span>
                                </td>
                              </>
                            ) : (
                              <td className={`num ${r.weeklyTickets < board.rules.MONTH_MIN_WEEKLY_TICKETS ? 'text-danger' : ''}`}>
                                {r.weeklyTickets}
                              </td>
                            )}
                            <td>
                              {r.eligible ? (
                                <TicketBadge status="ELIGIBLE" />
                              ) : (
                                <span className="text-sm muted">{missingText(r, board.rules, weekly)}</span>
                              )}
                            </td>
                            <td className="text-sm">
                              {r.ticket ? (
                                <TicketBadge status="ISSUED" detail={formatDateTime(r.ticket.issuedAt)} />
                              ) : (
                                <span className="muted">Chưa phát</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {!summaryView && board?.period && (
        <div className="page-actions">
          <span className="muted text-sm">Đã chọn {selected.size} trẻ</span>
          <div className="row gap-2">
            <button
              className="btn"
              disabled={!issuable.length || allSelected}
              onClick={() => setSelected(new Set(issuable.map((r) => r.child.id)))}
            >
              Chọn tất cả trẻ đủ điều kiện ({issuable.length})
            </button>
            <button className="btn btn--primary" disabled={!selected.size} onClick={() => setConfirmOpen(true)}>
              <Ticket size={16} /> Phát phiếu ({selected.size})
            </button>
          </div>
        </div>
      )}

      <ConfirmationModal
        open={confirmOpen}
        title={`Phát ${(TICKET_TYPE_LABELS[type] || '').toLowerCase()}?`}
        message={`Phát phiếu cho ${selected.size} trẻ – ${board?.period ? periodText(pType, board.period) : ''}. Kết quả được công bố cho phụ huynh và không thu hồi được.`}
        confirmLabel="Phát phiếu"
        onConfirm={doIssue}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
