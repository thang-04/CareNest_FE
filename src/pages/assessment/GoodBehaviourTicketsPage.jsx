import { useMemo, useState } from 'react';
import { BadgeCheck, CalendarRange, Info, Lock, Ticket } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAssessmentClasses, useTicketBoard } from '@/hooks/assessment/useAssessment';
import { issueTickets } from '@/services/assessment/assessmentService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { TICKET_TYPE, TICKET_TYPE_LABELS } from '@/models/assessment/assessmentConstants';
import { formatDateTime } from '@/utils/format';
import { periodLabel } from '@/utils/assessment/assessmentPeriods';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/** #60 Good Behaviour Tickets (UC 4.13, GBR-REW-01/02): the teacher issues tickets to eligible children; eligibility is rule-based. */
export default function GoodBehaviourTicketsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { classes, loading: classesLoading, error: classesError } = useAssessmentClasses();
  const [classId, setClassId] = useState('');
  const [type, setType] = useState(TICKET_TYPE.WEEKLY);
  const [periodStart, setPeriodStart] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const currentClassId = classId || classes[0]?.id || '';
  const params = useMemo(
    () => ({ classId: currentClassId, type, periodStart: periodStart || undefined }),
    [currentClassId, type, periodStart],
  );
  const { board, loading, error, reload } = useTicketBoard(params);

  const rows = board?.rows || [];
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
      toast.success(`Đã phát ${res.length} ${TICKET_TYPE_LABELS[type].toLowerCase()}. Phụ huynh đã được thông báo.`);
      setSelected(new Set());
      setConfirmOpen(false);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message, 'Chưa phát được phiếu');
      setConfirmOpen(false);
      reload({ silent: true });
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.tickets)} />
      <h1 className="page__title">Phiếu bé ngoan</h1>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Phiếu tuần: trẻ có mặt ít nhất <b>4 ngày</b> và có ít nhất <b>3 cờ bé ngoan</b> trong tuần. Phiếu tháng: trẻ có ít nhất{' '}
          <b>3 phiếu tuần</b> trong tháng (tuần tính vào tháng chứa ngày thứ Hai). Hệ thống tính điều kiện từ điểm danh và cờ bạn đã ghi;
          nếu thấy sai, hãy sửa điểm danh hoặc đánh giá hằng ngày.
        </div>
      </div>

      {classesError ? (
        <ErrorState error={classesError} />
      ) : !classesLoading && classes.length === 0 ? (
        <div className="card">
          <EmptyState icon={Lock} title="Bạn chưa được phân công lớp" description="Chỉ giáo viên của lớp mới phát phiếu bé ngoan." />
        </div>
      ) : (
        <div className="card">
          <div className="tabs" role="tablist">
            {[TICKET_TYPE.WEEKLY, TICKET_TYPE.MONTHLY].map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={type === t}
                className={`tab ${type === t ? 'tab--active' : ''}`}
                onClick={() =>
                  changeFilter(() => {
                    setType(t);
                    setPeriodStart('');
                  })
                }
              >
                {TICKET_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
            <div className="field" style={{ margin: 0 }}>
              <label className="field__label" htmlFor="dg-t-class">
                Lớp
              </label>
              <select
                id="dg-t-class"
                className="select"
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
            </div>
            <div className="field" style={{ margin: 0, minWidth: 220 }}>
              <label className="field__label" htmlFor="dg-t-period">
                {weekly ? 'Tuần đã kết thúc' : 'Tháng đã kết thúc'}
              </label>
              <select
                id="dg-t-period"
                className="select"
                value={board?.period?.start || ''}
                onChange={(e) => changeFilter(() => setPeriodStart(e.target.value))}
                disabled={!board?.periods.length}
              >
                {(board?.periods || []).map((p) => (
                  <option key={p.start} value={p.start}>
                    {periodLabel(pType, p.start, p.end)}
                  </option>
                ))}
              </select>
            </div>
            <div className="spacer" />
            {board?.period && (
              <div className="text-sm text-2" style={{ alignSelf: 'center' }}>
                Đủ điều kiện <b>{rows.filter((r) => r.eligible).length}</b>/{rows.length} · Đã phát <b>{issued}</b>
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
            <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th className="center" style={{ width: 48 }}>
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
                        <th className="right">Ngày có mặt</th>
                        <th className="right">Cờ bé ngoan</th>
                      </>
                    ) : (
                      <th className="right">Phiếu tuần trong tháng</th>
                    )}
                    <th>Điều kiện</th>
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
                          <div className="fw-600">{r.child.fullName}</div>
                          <div className="muted text-xs">{r.child.code}</div>
                        </td>
                        {weekly ? (
                          <>
                            <td className={`right ${r.presentDays < board.rules.WEEK_MIN_PRESENT_DAYS ? 'text-danger' : ''}`}>
                              {r.presentDays}/5
                            </td>
                            <td className={`right ${r.flagCount < board.rules.WEEK_MIN_FLAGS ? 'text-danger' : ''}`}>{r.flagCount}</td>
                          </>
                        ) : (
                          <td className={`right ${r.weeklyTickets < board.rules.MONTH_MIN_WEEKLY_TICKETS ? 'text-danger' : ''}`}>
                            {r.weeklyTickets}
                          </td>
                        )}
                        <td>
                          {r.eligible ? (
                            <span className="chip chip--green">Đủ điều kiện</span>
                          ) : (
                            <span className="chip chip--gray">Chưa đủ điều kiện</span>
                          )}
                        </td>
                        <td className="text-sm">
                          {r.ticket ? (
                            <span className="row" style={{ gap: 6 }}>
                              <BadgeCheck size={16} className="text-success" /> Đã phát {formatDateTime(r.ticket.issuedAt)}
                            </span>
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
        </div>
      )}

      {board?.period && (
        <div className="page-actions">
          <span className="muted text-sm">Đã chọn {selected.size} trẻ</span>
          <button className="btn btn--primary" disabled={!selected.size} onClick={() => setConfirmOpen(true)}>
            <Ticket size={16} /> Phát phiếu ({selected.size})
          </button>
        </div>
      )}

      <ConfirmationModal
        open={confirmOpen}
        title={`Phát ${TICKET_TYPE_LABELS[type].toLowerCase()}?`}
        message={`Phát phiếu cho ${selected.size} trẻ – ${board?.period ? periodLabel(pType, board.period.start, board.period.end) : ''}. Kết quả được công bố cho phụ huynh và không thu hồi được.`}
        confirmLabel="Phát phiếu"
        onConfirm={doIssue}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
