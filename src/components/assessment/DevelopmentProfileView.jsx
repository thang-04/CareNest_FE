import { childNameWithHistory } from '@/utils/childHistory';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, CalendarRange, ClipboardList, FileText, Flag, Ticket } from '@/components/ui/icons';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useChildDevelopment } from '@/hooks/assessment/useAssessment';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { DevelopmentCharts } from '@/components/assessment/DevelopmentCharts';
import { DailyDaysTable } from '@/components/assessment/DailyDaysTable';
import { PeriodSummaryTable } from '@/components/assessment/PeriodSummaryTable';
import { ChildAvatar } from '@/components/ChildAvatar';
import { formatDate } from '@/utils/format';
import { ageLabel, GENDER_LABELS } from '@/models/School';
import { PERIOD_TYPE_LABELS, TICKET_TYPE_LABELS } from '@/models/assessment/assessmentConstants';
import { periodLabel, todayIso } from '@/utils/assessment/assessmentPeriods';
import { developmentPeriods } from '@/utils/assessment/developmentPeriods';

const SCOPES = [
  { key: 'YEAR', label: 'Năm học' },
  { key: 'SEMESTER', label: 'Học kỳ' },
  { key: 'MONTH', label: 'Tháng' },
  { key: 'WEEK', label: 'Tuần' },
];

/**
 * Shared body of #53 Child Development Profile (teacher) and #54 Child Development Progress (Principal / VP).
 * Read-only: built from source records (GBR-DEV-01); only confirmed evaluations and approved rewards are shown.
 */
export function DevelopmentProfileView({ childId, mode, evaluationLink }) {
  const { schoolYear, schoolYears } = useSchoolYear();
  const year = schoolYears.find((y) => String(y.id) === String(schoolYear));
  const [scope, setScope] = useState('YEAR');
  const options = useMemo(() => developmentPeriods(scope, year, todayIso()), [scope, year]);
  const [periodIndex, setPeriodIndex] = useState(0);
  const period = options[Math.min(periodIndex, options.length - 1)] || null;
  const params = useMemo(() => (period ? { mode, start: period.start, end: period.end } : null), [mode, period]);
  const { development: d, loading, error, reload } = useChildDevelopment(childId, params);
  const [page, setPage] = useState(1);

  const daily = d?.dailyAssessments || [];
  const days = d?.days || [];
  const PAGE = 10;
  const tickets = d?.tickets || [];
  const rewards = d?.rewards || [];
  const published = d ? [...(d.yearEnd || []), ...(d.evaluations || [])] : [];
  const domainStats = d?.domainStats || [];

  return (
    <>
      <div className="card mb-16">
        <div className="card__body dg-period-bar">
          {d && !error && (
            <div className="dg-profile-head flex-1 min-w-220">
              <ChildAvatar child={d.child} size="lg" />
              <div>
                <div className="fw-600 text-lg">{childNameWithHistory(d.child.fullName, d.child.historyStatus)}</div>
                <div className="text-2 text-sm">
                  {[
                    d.child.code,
                    GENDER_LABELS[d.child.gender],
                    d.child.dateOfBirth && `${ageLabel(d.child.dateOfBirth)} (sinh ${formatDate(d.child.dateOfBirth)})`,
                    d.cls?.name || 'Chưa xếp lớp',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                {!loading && (
                  <div className="muted text-sm">
                    Có mặt {d.presentDays} ngày · Được đánh giá {days.length} ngày · {d.flagCount} cờ · {tickets.length} phiếu bé ngoan ·{' '}
                    {published.length} đánh giá đã xác nhận
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="field">
            <label className="field__label" htmlFor="dg-scope">
              Xem theo
            </label>
            <select
              id="dg-scope"
              className="select"
              value={scope}
              onChange={(e) => {
                setScope(e.target.value);
                setPeriodIndex(0);
                setPage(1);
              }}
            >
              {SCOPES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="dg-period">
              Kỳ
            </label>
            <select
              id="dg-period"
              className="select"
              value={Math.min(periodIndex, options.length - 1)}
              onChange={(e) => {
                setPeriodIndex(Number(e.target.value));
                setPage(1);
              }}
              disabled={options.length < 2}
            >
              {options.map((o, i) => (
                <option key={o.start} value={i}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error ? (
        error.status === 403 || error.status === 404 ? (
          <StatusPage
            bare
            kind={String(error.status)}
            title="Không xem được dữ liệu trong kỳ này"
            description="Hãy chọn kỳ nằm trong phạm vi bạn được phân công."
          />
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )
      ) : !period ? (
        <div className="card">
          <EmptyState
            icon={CalendarRange}
            title={scope === 'SEMESTER' ? 'Chưa có học kỳ được cấu hình và bắt đầu' : 'Chưa có kỳ phù hợp'}
            description="Kiểm tra năm học và thời gian học kỳ trong Cấu hình trường, hoặc chọn kỳ khác."
          />
        </div>
      ) : loading || !d ? (
        <LoadingState />
      ) : (
        <>
          {days.length === 0 && daily.length === 0 && published.length === 0 && tickets.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={ClipboardList}
                title={d.presentDays > 0 ? 'Chưa có đánh giá hằng ngày trong kỳ' : 'Chưa có dữ liệu trong kỳ'}
                description={
                  d.presentDays > 0
                    ? `Trẻ có mặt ${d.presentDays} ngày nhưng chưa được đánh giá hằng ngày, chưa có nhận xét đã xác nhận hay phiếu bé ngoan trong kỳ này.`
                    : 'Trẻ chưa có điểm danh, đánh giá hay nhận xét trong kỳ đã chọn. Hãy chọn kỳ khác.'
                }
              />
            </div>
          ) : (
            <>
              <PeriodSummaryTable data={d.summary} />
              {(d.weeks || []).length > 1 && (
                <div className="mt-16">
                  <DevelopmentCharts weeks={d.weeks} />
                </div>
              )}

              <div className={domainStats.length ? 'grid-2 mt-16' : 'mt-16'}>
                {domainStats.length > 0 && (
                  <div className="card">
                    <div className="card__header">
                      <div className="card__title">Mục tiêu đạt theo lĩnh vực</div>
                    </div>
                    <div className="card__body">
                      {domainStats.map((s) => {
                        const pct = s.possible ? Math.round((s.met / s.possible) * 100) : 0;
                        return (
                          <div key={s.domain} className="dg-domain">
                            <span className="text-sm">{s.domain}</span>
                            <div className="dg-domain__bar" role="img" aria-label={`${s.domain}: ${pct}%`}>
                              <div className="dg-domain__fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-sm dg-right">{s.possible ? `${pct}%` : '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="card">
                  <div className="card__header">
                    <div className="card__title">
                      <Ticket size={18} /> Phiếu bé ngoan & khen thưởng
                    </div>
                  </div>
                  <div className="card__body">
                    {tickets.length === 0 && rewards.length === 0 ? (
                      <EmptyState
                        title="Chưa có phiếu bé ngoan, khen thưởng"
                        description="Phiếu bé ngoan và khen thưởng trong kỳ sẽ hiện ở đây."
                      />
                    ) : (
                      <ul className="stack dg-plain-list">
                        {rewards.map((r) => (
                          <li key={r.id} className="row">
                            <Award size={16} className="text-success" /> <b>{r.rewardTitle}</b>
                            <span className="muted text-sm">
                              · Năm học {r.schoolYear} · phê duyệt {formatDate(r.approvedAt)}
                            </span>
                          </li>
                        ))}
                        {tickets.map((t) => (
                          <li key={t.id} className="row">
                            <Flag size={16} className="text-primary" /> {TICKET_TYPE_LABELS[t.type]}
                            <span className="muted text-sm">
                              · {periodLabel(t.type === 'WEEKLY' ? 'WEEK' : 'MONTH', t.periodStart, t.periodEnd)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="card mt-16">
                <div className="card__header">
                  <div className="card__title">
                    <FileText size={18} /> Đánh giá đã xác nhận
                  </div>
                </div>
                <div className="card__body">
                  {published.length === 0 ? (
                    <EmptyState
                      title="Chưa có đánh giá được xác nhận"
                      description="Đánh giá tháng, học kỳ, cuối năm hiện ở đây sau khi giáo viên xác nhận."
                    />
                  ) : (
                    <div className="stack">
                      {published.map((e) => (
                        <div key={e.id} className="card dg-card-flat">
                          <div className="card__body">
                            <div className="row row--between mb-8">
                              <div className="fw-600">
                                {PERIOD_TYPE_LABELS[e.periodType]} · {periodLabel(e.periodType, e.periodStart, e.periodEnd)}
                              </div>
                              {evaluationLink?.(e) && (
                                <Link className="btn btn--sm" to={evaluationLink(e)}>
                                  Xem chi tiết
                                </Link>
                              )}
                            </div>
                            <div className="dg-final text-sm">{e.finalContent}</div>
                            <div className="muted text-xs mt-8">Xác nhận ngày {formatDate(e.confirmedAt)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="card mt-16">
                <div className="card__header">
                  <div className="card__title">
                    <ClipboardList size={18} /> Đánh giá hằng ngày
                  </div>
                  <span className="muted text-sm">{days.length} ngày · Xanh: đạt · Đỏ: chưa đạt</span>
                </div>
                <div className="card__body">
                  <DailyDaysTable
                    days={paginate([...days].reverse(), page, PAGE)}
                    mealSessions={d.mealSessions}
                    classId={d.cls?.id}
                    linkDays={mode === 'profile'}
                  />
                </div>
                {days.length > PAGE && <Pagination page={page} total={days.length} pageSize={PAGE} onChange={setPage} unit="ngày" />}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
