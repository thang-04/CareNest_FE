import { DonutChart } from '@/components/charts/MiniCharts';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, BarChart3 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES } from '@/models/User';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '@/components/ui/States';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { DateInput } from '@/components/form/DateInput';
import { paginate } from '@/components/ui/Pagination';
import { useAttendanceClasses, useAttendanceSummary } from '@/hooks/attendance/useAttendance';
import { validateSummaryRange } from '@/utils/attendance/attendanceValidation';
import { addDays, schoolToday } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { downloadCsv } from '@/utils/exportCsv';
import { formatDate, isIsoDate } from '@/utils/format';
import '@/styles/modules/attendance.css';

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const weekday = (date) => WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];

/** #66 Class Attendance Summary (UC 6.15): attendance and meal totals of a class over a period. */
export default function AttendanceSummaryPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const today = schoolToday();
  const { classes, loading: loadingClasses, error: classError, reload: reloadClasses } = useAttendanceClasses();
  const classId = params.get('classId') || classes[0]?.id || '';
  const [range, setRange] = useState({ from: params.get('from') || addDays(today, -13), to: params.get('to') || today });
  const [pageSize, setPageSize] = useState(20);
  const [pageState, setPageState] = useState({ key: '', value: 1 });
  const rangeErrors = validateSummaryRange(range);
  const valid = Object.keys(rangeErrors).length === 0;
  const { summary: loadedSummary, loading, error, reload } = useAttendanceSummary(valid ? { classId, ...range } : {});
  const summary =
    valid && !loading && !error && loadedSummary?.classId === classId && loadedSummary.from === range.from && loadedSummary.to === range.to
      ? loadedSummary
      : null;
  const pageKey = `${classId}:${range.from}:${range.to}:${pageSize}`;
  const pageCount = Math.max(1, Math.ceil((summary?.days.length || 0) / pageSize));
  const page = Math.min(pageState.key === pageKey ? pageState.value : 1, pageCount);
  const setPage = (value) => setPageState({ key: pageKey, value });

  const setRangeValue = (key, value) => {
    const next = { ...range, [key]: value };
    setRange(next);
    if (isIsoDate(next.from) && isIsoDate(next.to)) setParams({ classId, ...next }, { replace: true });
  };

  const exportCsv = () => {
    if (!summary) return;
    const head = ['Ngày', 'Có mặt', 'Vắng có phép', 'Vắng không phép', 'Chưa điểm danh', 'Suất ăn', 'Trong đó suất thay thế'];
    const rows = summary.days.map((d) => [formatDate(d.date), d.present, d.excused, d.unexcused, d.missing, d.mealTotal, d.substitute]);
    downloadCsv(
      [[`Tổng hợp điểm danh ${summary.className} ${formatDate(range.from)} – ${formatDate(range.to)}`], head, ...rows],
      `diem-danh-${summary.className}-${range.from}-${range.to}.csv`,
    );
  };

  if (loadingClasses) return <LoadingState />;
  const totals = summary?.days.reduce(
    (t, d) => ({
      present: t.present + d.present,
      excused: t.excused + d.excused,
      unexcused: t.unexcused + d.unexcused,
      meals: t.meals + d.mealTotal,
    }),
    { present: 0, excused: 0, unexcused: 0, meals: 0 },
  );

  return (
    <div className="page">
      <Breadcrumb
        items={attendanceCrumbs('Tổng hợp điểm danh lớp', { linkParent: [ROLES.TEACHER, ROLES.TEAM_LEADER].includes(user?.role) })}
      />
      <div className="page__head">
        <h1 className="page__title">Tổng hợp điểm danh lớp</h1>
        {summary?.days.length > 0 && (
          <button className="btn mt-8" onClick={exportCsv}>
            <Download size={16} /> Xuất Excel
          </button>
        )}
      </div>
      {classError ? (
        <ErrorState error={classError} onRetry={reloadClasses} />
      ) : classes.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={BarChart3}
            title="Không có lớp trong phạm vi của bạn"
            description="Bạn chỉ xem được lớp được phân công hoặc lớp thuộc điểm trường của mình."
          />
        </div>
      ) : (
        <>
          <ClassDateBar classes={classes} classId={classId} onClassChange={(v) => setParams({ classId: v, ...range }, { replace: true })}>
            <div className="dd-bar__field">
              <label className="field__label" htmlFor="dd-from">
                Từ ngày
              </label>
              <DateInput
                id="dd-from"
                className={rangeErrors.from ? 'is-invalid' : ''}
                value={range.from}
                max={today}
                onChange={(value) => setRangeValue('from', value)}
                aria-invalid={!!rangeErrors.from}
                aria-describedby={!valid ? 'dd-range-error' : undefined}
              />
            </div>
            <div className="dd-bar__field">
              <label className="field__label" htmlFor="dd-to">
                Đến ngày
              </label>
              <DateInput
                id="dd-to"
                className={rangeErrors.to ? 'is-invalid' : ''}
                value={range.to}
                max={today}
                onChange={(value) => setRangeValue('to', value)}
                aria-invalid={!!rangeErrors.to}
                aria-describedby={!valid ? 'dd-range-error' : undefined}
              />
            </div>
            {!valid && (
              <span className="field__error dd-bar__error" id="dd-range-error" role="alert">
                {rangeErrors.to || rangeErrors.from}
              </span>
            )}
          </ClassDateBar>

          {!valid ? (
            <div className="card">
              <EmptyState title="Chọn khoảng ngày hợp lệ" description="Nhập đủ ngày bắt đầu và kết thúc để xem tổng hợp." />
            </div>
          ) : error ? (
            <div className="card">
              <ErrorState error={error} onRetry={reload} />
            </div>
          ) : (
            <>
              {summary && totals && (
                <div className="dd-overview mb-16">
                  <div className="card" style={{ padding: 20 }}>
                    <DonutChart
                      caption="Tỷ lệ lượt có mặt và vắng trong kỳ"
                      center={totals.present}
                      segments={[
                        { key: 'present', label: 'Lượt có mặt', value: totals.present, color: 'var(--success)' },
                        { key: 'excused', label: 'Vắng có phép', value: totals.excused, color: 'var(--warning)' },
                        { key: 'unexcused', label: 'Vắng không phép', value: totals.unexcused, color: 'var(--danger)' },
                      ]}
                    />
                  </div>
                  <div className="dd-stats">
                    <div className="dd-stat">
                      <span className="dd-stat__value">{summary.size}</span>
                      <span className="dd-stat__label">Sĩ số lớp</span>
                    </div>
                    <div className="dd-stat">
                      <span className="dd-stat__value">{summary.days.length}</span>
                      <span className="dd-stat__label">Ngày học</span>
                    </div>
                    <div className="dd-stat dd-stat--green">
                      <span className="dd-stat__value">{totals.present}</span>
                      <span className="dd-stat__label">Lượt có mặt</span>
                    </div>
                    <div className="dd-stat dd-stat--orange">
                      <span className="dd-stat__value">{totals.excused}</span>
                      <span className="dd-stat__label">Vắng có phép</span>
                    </div>
                    <div className="dd-stat dd-stat--red">
                      <span className="dd-stat__value">{totals.unexcused}</span>
                      <span className="dd-stat__label">Vắng không phép</span>
                    </div>
                    <div className="dd-stat dd-stat--blue">
                      <span className="dd-stat__value">{totals.meals}</span>
                      <span className="dd-stat__label">Suất ăn</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="dd-summary">
                <div className="card">
                  <div className="card__header">
                    <div className="card__title">Theo ngày</div>
                  </div>
                  <div className="table-wrap dd-table-wrap">
                    <table className="table table--compact">
                      <thead>
                        <tr>
                          <th>Ngày</th>
                          <th className="right">Có mặt</th>
                          <th className="right">Có phép</th>
                          <th className="right">Không phép</th>
                          <th className="right">Chưa ĐD</th>
                          <th className="right">Suất ăn</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading || !summary ? (
                          <SkeletonRows rows={5} cols={6} />
                        ) : summary.days.length === 0 ? (
                          <tr>
                            <td colSpan={6}>
                              <EmptyState title="Không có dữ liệu trong khoảng đã chọn" description="Chọn khoảng ngày khác có ngày học." />
                            </td>
                          </tr>
                        ) : (
                          paginate(summary.days, page, pageSize).map((d) => (
                            <tr key={d.date}>
                              <td className="nowrap">
                                <span className="muted text-xs dd-weekday">{weekday(d.date)}</span> {formatDate(d.date)}
                              </td>
                              <td className="right fw-600">{d.present}</td>
                              <td className="right">{d.excused}</td>
                              <td className={`right ${d.unexcused ? 'text-danger' : ''}`}>{d.unexcused}</td>
                              <td className="right muted">{d.missing || '—'}</td>
                              <td className="right">{d.mealTotal}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {summary?.days.length > 0 && (
                    <div className="row row--between row--wrap pagination">
                      <label className="row">
                        <span>Số dòng</span>
                        <select
                          className="select"
                          aria-label="Số ngày mỗi trang"
                          value={pageSize}
                          onChange={(event) => setPageSize(Number(event.target.value))}
                        >
                          {[10, 20, 50].map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="muted" aria-live="polite">
                        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, summary.days.length)} / {summary.days.length} ngày
                      </span>
                      <div className="row">
                        <button className="btn btn--sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                          Trang trước
                        </button>
                        <span>
                          Trang {page}/{pageCount}
                        </span>
                        <button className="btn btn--sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                          Trang sau
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="card">
                  <div className="card__header">
                    <div className="card__title">Theo trẻ</div>
                  </div>
                  <div className="table-wrap dd-table-wrap">
                    <table className="table table--compact">
                      <thead>
                        <tr>
                          <th>Trẻ</th>
                          <th className="right">Có mặt</th>
                          <th className="right">Có phép</th>
                          <th className="right">Không phép</th>
                          <th className="right">Suất ăn</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading || !summary ? (
                          <SkeletonRows rows={5} cols={5} />
                        ) : summary.children.length === 0 ? (
                          <tr>
                            <td colSpan={5}>
                              <EmptyState title="Lớp chưa có trẻ" />
                            </td>
                          </tr>
                        ) : (
                          summary.children.map((c) => (
                            <tr key={c.child.id}>
                              <td>{c.child.fullName}</td>
                              <td className="right fw-600">{c.present}</td>
                              <td className="right">{c.excused}</td>
                              <td className={`right ${c.unexcused ? 'text-danger' : ''}`}>{c.unexcused}</td>
                              <td className="right">{c.meals}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
