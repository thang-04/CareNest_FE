import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, CalendarRange, ClipboardList, FileText, Flag, Lock, Ticket } from 'lucide-react';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useChildDevelopment } from '@/hooks/assessment/useAssessment';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { DevelopmentCharts } from '@/components/assessment/DevelopmentCharts';
import { formatDate } from '@/utils/format';
import { ageLabel, GENDER_LABELS } from '@/models/School';
import { EMOTION_LABELS, HEALTH_STATUS_LABELS, PERIOD_TYPE_LABELS, TICKET_TYPE_LABELS } from '@/models/assessment/assessmentConstants';
import {
  monthEnd,
  monthsBetween,
  periodLabel,
  schoolYearRange,
  todayIso,
  weekEnd,
  weeksBetween,
} from '@/utils/assessment/assessmentPeriods';

const SCOPES = [
  { key: 'YEAR', label: 'Năm học' },
  { key: 'SEMESTER', label: 'Học kỳ' },
  { key: 'MONTH', label: 'Tháng' },
  { key: 'WEEK', label: 'Tuần' },
];

/** Period options of the school year (semesters assumed: Sep–Dec and Jan–May). */
const periodOptions = (scope, schoolYear) => {
  const { start, end } = schoolYearRange(schoolYear);
  const today = todayIso();
  const until = end < today ? end : today;
  if (scope === 'YEAR') return [{ start, end, label: periodLabel('YEAR', start, end) }];
  if (scope === 'SEMESTER')
    return [
      { start, end: `${start.slice(0, 4)}-12-31`, label: 'Học kỳ I' },
      { start: `${end.slice(0, 4)}-01-01`, end, label: 'Học kỳ II' },
    ];
  if (until < start) return [];
  if (scope === 'MONTH')
    return monthsBetween(start, until)
      .map((m) => ({ start: m, end: monthEnd(m), label: periodLabel('MONTH', m) }))
      .reverse();
  return weeksBetween(start, until)
    .map((w) => ({ start: w, end: weekEnd(w), label: periodLabel('WEEK', w, weekEnd(w)) }))
    .reverse();
};

function Kpi({ value, label }) {
  return (
    <div className="dg-kpi">
      <div className="dg-kpi__value">{value}</div>
      <div className="dg-kpi__label">{label}</div>
    </div>
  );
}

/**
 * Shared body of #53 Child Development Profile (teacher) and #54 Child Development Progress (Principal / VP).
 * Read-only: built from source records (GBR-DEV-01); only confirmed evaluations and approved rewards are shown.
 */
export function DevelopmentProfileView({ childId, mode, evaluationLink }) {
  const { schoolYear } = useSchoolYear();
  const [scope, setScope] = useState('YEAR');
  const options = useMemo(() => periodOptions(scope, schoolYear), [scope, schoolYear]);
  const [periodIndex, setPeriodIndex] = useState(0);
  const period = options[Math.min(periodIndex, options.length - 1)] || null;
  const params = useMemo(() => (period ? { mode, start: period.start, end: period.end } : null), [mode, period]);
  const { development: d, loading, error, reload } = useChildDevelopment(childId, params);
  const [page, setPage] = useState(1);

  if (error) {
    if (error.status === 403 || error.status === 404)
      return (
        <EmptyState
          icon={Lock}
          title="Không xem được hồ sơ"
          description="Bạn không có quyền xem hồ sơ của trẻ này hoặc trẻ không tồn tại."
        />
      );
    return <ErrorState error={error} onRetry={reload} />;
  }

  const crit = d ? Object.fromEntries(d.criteria.map((c) => [c.id, c.name])) : {};
  const daily = d?.dailyAssessments || [];
  const finishedWeeks = d?.weeks.filter((w) => w.finished) || [];
  const missing = finishedWeeks.filter((w) => !w.evaluationConfirmed);

  return (
    <>
      <div className="card mb-16">
        <div className="card__body dg-period-bar">
          {d && (
            <div style={{ flex: 1, minWidth: 220 }}>
              <div className="fw-600 text-lg">{d.child.fullName}</div>
              <div className="text-2 text-sm">
                {d.child.code} · {GENDER_LABELS[d.child.gender]} · {ageLabel(d.child.dateOfBirth)} · {d.cls?.name || 'Chưa xếp lớp'}
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

      {!period ? (
        <div className="card">
          <EmptyState icon={CalendarRange} title="Năm học chưa bắt đầu" description="Chọn năm học khác ở thanh trên cùng." />
        </div>
      ) : loading || !d ? (
        <LoadingState />
      ) : (
        <>
          <div className="dg-kpis mb-16">
            <Kpi value={daily.length} label="Lượt đánh giá hằng ngày" />
            <Kpi value={daily.filter((a) => a.flag).length} label="Cờ bé ngoan" />
            <Kpi value={d.tickets.length} label="Phiếu bé ngoan" />
            <Kpi value={d.evaluations.length + d.yearEnd.length} label="Đánh giá đã công bố" />
          </div>

          {daily.length === 0 && d.evaluations.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={ClipboardList}
                title="Chưa có dữ liệu trong kỳ"
                description="Không có hồ sơ nào trong phạm vi hoặc kỳ đã chọn. Hãy chọn kỳ khác."
              />
            </div>
          ) : (
            <>
              {missing.length > 0 && (
                <div className="alert alert--info mb-16">
                  <CalendarRange size={18} />
                  <div>
                    {missing.length} tuần đã kết thúc chưa có đánh giá tuần được công bố:{' '}
                    {missing.map((w) => formatDate(w.weekStart)).join(', ')}. Hồ sơ chỉ hiển thị dữ liệu đã có, không suy đoán kết quả cho
                    các tuần này.
                  </div>
                </div>
              )}
              {d.weeks.length > 1 && <DevelopmentCharts weeks={d.weeks} />}

              <div className="split-2 mt-16">
                <div className="card">
                  <div className="card__header">
                    <div className="card__title">Tiêu chí đạt theo lĩnh vực</div>
                  </div>
                  <div className="card__body">
                    {d.domainStats.map((s) => {
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
                    <div className="muted text-xs">Tỉ lệ = số lượt đạt tiêu chí / số lượt đánh giá trong kỳ.</div>
                  </div>
                </div>
                <div className="card">
                  <div className="card__header">
                    <div className="card__title">
                      <Ticket size={18} /> Phiếu bé ngoan & khen thưởng
                    </div>
                  </div>
                  <div className="card__body">
                    {d.tickets.length === 0 && d.rewards.length === 0 ? (
                      <div className="muted">Chưa có phiếu bé ngoan hoặc khen thưởng trong kỳ.</div>
                    ) : (
                      <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        {d.rewards.map((r) => (
                          <li key={r.id} className="row">
                            <Award size={16} className="text-success" /> <b>{r.rewardTitle}</b>
                            <span className="muted text-sm">
                              · Năm học {r.schoolYear} · phê duyệt {formatDate(r.approvedAt)}
                            </span>
                          </li>
                        ))}
                        {d.tickets.map((t) => (
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
                    <FileText size={18} /> Đánh giá đã công bố
                  </div>
                </div>
                <div className="card__body">
                  {d.evaluations.length + d.yearEnd.length === 0 ? (
                    <div className="muted">Chưa có đánh giá tuần, tháng hoặc cuối năm được giáo viên xác nhận trong kỳ.</div>
                  ) : (
                    <div className="stack">
                      {[...d.yearEnd, ...d.evaluations].map((e) => (
                        <div key={e.id} className="card" style={{ boxShadow: 'none' }}>
                          <div className="card__body">
                            <div className="row row--between mb-8">
                              <div className="fw-600">
                                {PERIOD_TYPE_LABELS[e.periodType]} · {periodLabel(e.periodType, e.periodStart, e.periodEnd)}
                              </div>
                              {evaluationLink && (
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
                  <span className="muted text-sm">{daily.length} lượt</span>
                </div>
                <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>Ngày</th>
                        <th>Hoạt động</th>
                        <th>Sức khỏe</th>
                        <th>Cảm xúc</th>
                        <th>Tiêu chí đạt</th>
                        <th className="center">Cờ</th>
                        <th>Nhận xét</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginate(daily, page).map((a) => (
                        <tr key={a.id}>
                          <td className="nowrap">{formatDate(a.date)}</td>
                          <td>{a.activity}</td>
                          <td>{HEALTH_STATUS_LABELS[a.healthStatus]}</td>
                          <td>{EMOTION_LABELS[a.emotion]}</td>
                          <td className="text-sm" style={{ whiteSpace: 'normal', minWidth: 200 }}>
                            {a.criteriaMet
                              .map((id) => crit[id])
                              .filter(Boolean)
                              .join(', ') || '—'}
                          </td>
                          <td className="center">{a.flag ? <Flag size={16} className="text-primary" aria-label="Có cờ" /> : '—'}</td>
                          <td className="text-sm" style={{ whiteSpace: 'normal', minWidth: 180 }}>
                            {a.comment || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {daily.length > 0 && <Pagination page={page} total={daily.length} onChange={setPage} unit="lượt" />}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
