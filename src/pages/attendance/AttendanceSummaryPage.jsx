import { DonutChart } from '@/components/charts/MiniCharts';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, BarChart3, Buildings, School } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useMasterData } from '@/hooks/useMasterData';
import { ROLES } from '@/models/User';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '@/components/ui/States';
import { StatCard } from '@/components/ui/StatCard';
import { ClassDateBar } from '@/components/attendance/ClassDateBar';
import { DateInput } from '@/components/form/DateInput';
import { SelectField } from '@/components/form/Field';
import { SemesterSelect } from '@/components/form/SemesterSelect';
import { semesterRange } from '@/utils/semesters';
import { paginate } from '@/components/ui/Pagination';
import { useAttendanceClasses, useAttendanceSummary, useAttendanceYear } from '@/hooks/attendance/useAttendance';
import { useAgeGroupOptions } from '@/hooks/attendance/useAgeGroupOptions';
import { useYearCampuses } from '@/hooks/useYearCampuses';
import { campusOptionLabel } from '@/utils/campusLabel';
import { PERMISSIONS } from '@/models/bePermissions';
import { MEAL_SESSION_LABELS } from '@/models/attendance/attendanceConstants';
import { validateSummaryRange } from '@/utils/attendance/attendanceValidation';
import { addDays } from '@/utils/attendance/attendanceTime';
import { attendanceCrumbs } from '@/utils/attendance/breadcrumbs';
import { exportWithPreviewWorkbook } from '@/components/ui/ExportPreview';
import { formatDate, isIsoDate } from '@/utils/format';
import '@/styles/modules/attendance.css';

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const weekday = (date) => WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
// ATT-14: số ngày có mặt quy đổi (nửa buổi 0,5) hiển thị kiểu Việt Nam
const days = (value) => (value == null ? '—' : String(value).replace('.', ','));
// BE chưa trả số theo bữa (bản cũ) thì hiện "—", không ghi 0 gây hiểu nhầm
const mealCount = (counts, session) => (counts ? (counts[session] ?? 0) : '—');

/**
 * #66 Attendance Summary (UC 6.15): attendance and meal totals over a period.
 * Ban giám hiệu: toàn trường / một điểm trường / một lớp (mặc định toàn trường, tất cả lớp); giáo viên: lớp của mình.
 */
export default function AttendanceSummaryPage() {
  const { user } = useAuth();
  const md = useMasterData();
  const [params, setParams] = useSearchParams();
  const { defaultDate: today } = useAttendanceYear();
  const { classes, loading: loadingClasses, error: classError, reload: reloadClasses } = useAttendanceClasses();
  const manager = [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL].includes(user?.role);
  // Điểm trường chọn được = điểm trường có lớp trong phạm vi xem (PHT thường chỉ điểm trường của mình)
  // HT: đủ điểm trường của năm đang chọn (kể cả chưa có lớp); PHT: điểm trường có lớp trong phạm vi xem
  const yearCampuses = useYearCampuses(PERMISSIONS.ATTENDANCE_VIEW);
  const campusOptions = yearCampuses || md.campuses.filter((c) => classes.some((cls) => String(cls.campusId) === String(c.id)));
  const campusId = manager ? (campusOptions.length === 1 ? campusOptions[0].id : params.get('campus') || '') : '';
  // Lọc nhóm tuổi (ATT-14): lớp chọn được và tổng hợp nhiều lớp chỉ gồm lớp của nhóm tuổi đó
  const ageGroupOptions = useAgeGroupOptions(classes.filter((c) => !campusId || String(c.campusId) === String(campusId)));
  const ageGroupId = manager && ageGroupOptions.some((g) => g.id === params.get('ageGroup')) ? params.get('ageGroup') : '';
  const campusClasses = classes.filter(
    (c) => (!campusId || String(c.campusId) === String(campusId)) && (!ageGroupId || String(c.ageGroupId) === ageGroupId),
  );
  const paramClass = params.get('classId') || '';
  // Tổ trưởng chuyên môn: xem lớp mình hoặc tổng hợp các lớp nhóm tuổi mình (BE lọc theo nhóm tuổi, Cần chốt 04/11)
  const teamLeader = user?.role === ROLES.TEAM_LEADER;
  // Tổ trưởng không dạy lớp nào thì chỉ có phạm vi các lớp nhóm tuổi
  const groupMode = teamLeader && (params.get('scope') === 'group' || (!loadingClasses && classes.length === 0));
  const classId = manager
    ? campusClasses.some((c) => c.id === paramClass)
      ? paramClass
      : ''
    : groupMode
      ? paramClass // bấm một lớp trong bảng "Theo lớp" thì xem riêng lớp đó (BE cho tổ trưởng xem tổng hợp lớp nhóm mình)
      : paramClass || classes[0]?.id || '';
  const multi = (manager || groupMode) && !classId;
  const [range, setRange] = useState({ from: params.get('from') || addDays(today, -13), to: params.get('to') || today });
  // Lọc nhanh theo học kỳ: đặt Từ ngày – Đến ngày theo học kỳ (cắt tới hôm nay); sửa ngày tay thì bỏ chọn
  const [semester, setSemester] = useState('');
  // Đổi năm học ở đầu trang: khoảng ngày và học kỳ về mặc định của năm mới (không gửi ngày của năm cũ)
  const yearToday = useRef(today);
  useEffect(() => {
    if (yearToday.current === today) return;
    yearToday.current = today;
    setRange({ from: addDays(today, -13), to: today });
    setSemester('');
  }, [today]);
  const [pageSize, setPageSize] = useState(20);
  const [pageState, setPageState] = useState({ key: '', value: 1 });
  const rangeErrors = validateSummaryRange(range);
  const valid = Object.keys(rangeErrors).length === 0;
  const {
    summary: loadedSummary,
    loading,
    error,
    reload,
  } = useAttendanceSummary(valid ? { classId, campusId, ageGroupId: multi ? ageGroupId : '', multi, ...range } : {});
  const sameScope = multi
    ? loadedSummary?.scope === 'MULTI' && String(loadedSummary.campusId || '') === String(campusId || '')
    : loadedSummary?.scope === 'CLASS' && loadedSummary.classId === classId;
  const summary =
    valid && !loading && !error && sameScope && loadedSummary.from === range.from && loadedSummary.to === range.to ? loadedSummary : null;
  const campusName = (id) => md.campusById?.(id)?.shortName || md.campusById?.(id)?.name || '';
  const scopeName = classId ? summary?.className || '' : groupMode ? 'Các lớp nhóm tuổi' : campusId ? campusName(campusId) : 'Toàn trường';
  const query = (next) =>
    Object.fromEntries(
      Object.entries({ campus: campusId, ageGroup: ageGroupId, classId, scope: groupMode ? 'group' : '', ...range, ...next }).filter(
        ([, v]) => v,
      ),
    );
  const pageKey = `${campusId}:${ageGroupId}:${classId}:${range.from}:${range.to}:${pageSize}`;
  // Cột bữa: chỉ các bữa nhóm tuổi / các lớp đang xem có
  const mealCols = summary?.mealSessions || [];
  const pageCount = Math.max(1, Math.ceil((summary?.days.length || 0) / pageSize));
  const page = Math.min(pageState.key === pageKey ? pageState.value : 1, pageCount);
  const setPage = (value) => setPageState({ key: pageKey, value });

  const applyRange = (next) => {
    setRange(next);
    if (isIsoDate(next.from) && isIsoDate(next.to)) setParams(query(next), { replace: true });
  };
  const setRangeValue = (key, value) => {
    setSemester('');
    applyRange({ ...range, [key]: value });
  };
  const pickSemester = (key, sem) => {
    const next = semesterRange(sem, today);
    setSemester(next ? key : '');
    if (next) applyRange(next);
  };

  const exportExcel = () => {
    if (!summary) return;
    const mealHead = mealCols.map((s) => MEAL_SESSION_LABELS[s] || s);
    const head = [
      'Ngày',
      'Có mặt',
      'Vắng có phép',
      'Vắng không phép',
      'Chưa điểm danh',
      'Nghỉ sáng',
      'Nghỉ chiều',
      ...mealHead,
      'Trẻ có ăn',
      'Trong đó ăn suất thay thế',
    ];
    const rows = summary.days.map((d) => [
      formatDate(d.date),
      d.present,
      d.excused,
      d.unexcused,
      d.missing,
      d.morningOff ?? 0,
      d.afternoonOff ?? 0,
      ...mealCols.map((s) => mealCount(d.meals, s)),
      d.mealTotal,
      d.substitute,
    ]);
    const detailHead = multi
      ? ['Lớp', 'Điểm trường', 'Sĩ số', 'Có mặt', 'Vắng có phép', 'Vắng không phép', 'Lượt trẻ ăn']
      : ['Trẻ', 'Ngày có mặt', 'Có mặt', 'Vắng có phép', 'Vắng không phép', 'Nghỉ sáng', 'Nghỉ chiều', ...mealHead, 'Ngày có ăn'];
    const detailRows = multi
      ? summary.classes.map((c) => [c.className, campusName(c.campusId), c.size, c.present, c.excused, c.unexcused, c.meals])
      : summary.children.map((c) => [
          c.child.fullName,
          c.attendedDays ?? c.present,
          c.present,
          c.excused,
          c.unexcused,
          c.morningOff ?? 0,
          c.afternoonOff ?? 0,
          ...mealCols.map((s) => mealCount(c.mealCounts, s)),
          c.meals,
        ]);
    const title = [`Tổng hợp điểm danh ${scopeName} ${formatDate(range.from)} – ${formatDate(range.to)}`];
    const slug = (classId ? summary.className : campusId ? campusName(campusId) : 'toan-truong').replace(/\s+/g, '-');
    exportWithPreviewWorkbook(
      [
        { sheetName: 'Theo ngày', rows: [title, head, ...rows], headerRow: 1 },
        { sheetName: multi ? 'Theo lớp' : 'Theo trẻ', rows: [title, detailHead, ...detailRows], headerRow: 1 },
      ],
      `diem-danh-${slug}-${range.from}-${range.to}.xlsx`,
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
      <Breadcrumb items={attendanceCrumbs('Tổng hợp điểm danh', { linkParent: [ROLES.TEACHER, ROLES.TEAM_LEADER].includes(user?.role) })} />
      <div className="page__head">
        <div>
          <h1 className="page__title">Tổng hợp điểm danh</h1>
          {scopeName && (
            <p className="muted text-sm">{classId ? `Lớp ${scopeName.replace(/^Lớp\s+/i, '')}` : `Tất cả lớp · ${scopeName}`}</p>
          )}
        </div>
        {summary?.days.length > 0 && (
          <button className="btn mt-8" onClick={exportExcel}>
            <Download size={16} /> Xuất Excel
          </button>
        )}
      </div>
      {classError ? (
        <ErrorState error={classError} onRetry={reloadClasses} />
      ) : classes.length === 0 && !teamLeader ? (
        <div className="card">
          <EmptyState
            icon={BarChart3}
            title="Không có lớp trong phạm vi của bạn"
            description="Bạn chỉ xem được lớp được phân công hoặc lớp thuộc điểm trường của mình."
          />
        </div>
      ) : (
        <>
          <ClassDateBar
            classes={manager || groupMode ? undefined : classes}
            classId={classId}
            onClassChange={(v) => setParams(query({ classId: v }), { replace: true })}
          >
            {teamLeader && (
              <div className="dd-bar__field">
                <label className="field__label" htmlFor="dd-scope">
                  <Buildings size={15} /> Phạm vi
                </label>
                <select
                  id="dd-scope"
                  className="select"
                  value={groupMode ? 'group' : ''}
                  onChange={(e) => setParams(query({ scope: e.target.value, classId: '' }), { replace: true })}
                >
                  <option value="">Lớp của tôi</option>
                  <option value="group">Các lớp nhóm tuổi</option>
                </select>
              </div>
            )}
            {manager && campusOptions.length > 1 && (
              <div className="dd-bar__field">
                <label className="field__label" htmlFor="dd-campus">
                  <Buildings size={15} /> Phạm vi
                </label>
                <select
                  id="dd-campus"
                  className="select"
                  value={campusId}
                  onChange={(e) => setParams(query({ campus: e.target.value, classId: '' }), { replace: true })}
                >
                  <option value="">Toàn trường</option>
                  {campusOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {campusOptionLabel(c, campusOptions)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {manager && ageGroupOptions.length > 1 && (
              <SelectField
                id="dd-age-group"
                label="Nhóm tuổi"
                fieldClassName="dd-bar__field"
                value={ageGroupId}
                onChange={(e) => setParams(query({ ageGroup: e.target.value, classId: '' }), { replace: true })}
                placeholder="Tất cả nhóm tuổi"
                options={ageGroupOptions.map((g) => ({ value: g.id, label: g.name }))}
              />
            )}
            {manager && (
              <div className="dd-bar__field">
                <label className="field__label" htmlFor="dd-class">
                  <School size={15} /> Lớp
                </label>
                <select
                  id="dd-class"
                  className="select"
                  value={classId}
                  onChange={(e) => setParams(query({ classId: e.target.value }), { replace: true })}
                >
                  <option value="">Tất cả lớp</option>
                  {campusClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {!campusId && campusOptions.length > 1 ? ` · ${campusName(c.campusId)}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="dd-bar__field">
              <label className="field__label" htmlFor="dd-semester">
                Học kỳ
              </label>
              <SemesterSelect id="dd-semester" value={semester} onChange={pickSemester} emptyLabel="Chọn ngày" />
            </div>
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

          {campusId && !campusClasses.length ? (
            <div className="card">
              <EmptyState title="Chưa có dữ liệu" description="Điểm trường này chưa có lớp trong năm học đang chọn." />
            </div>
          ) : !valid ? (
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
                  <div className="card dd-overview__chart">
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
                    <StatCard
                      tone="blue"
                      label={<>{multi ? `Sĩ số (${summary.classes.length} lớp)` : 'Sĩ số lớp'}</>}
                      value={summary.size}
                    />
                    <StatCard tone="blue" label="Ngày học" value={summary.days.length} />
                    <StatCard tone="green" label="Lượt có mặt" value={totals.present} />
                    <StatCard tone="orange" label="Vắng có phép" value={totals.excused} />
                    <StatCard tone="red" label="Vắng không phép" value={totals.unexcused} />
                    <StatCard
                      tone="teal"
                      label={
                        <span title="Số lượt trẻ có ăn trong ngày (mỗi trẻ 1 lượt/ngày); số suất theo bữa xem ở Sổ suất ăn">
                          Lượt trẻ ăn
                        </span>
                      }
                      value={totals.meals}
                    />
                  </div>
                </div>
              )}

              <div className="dd-summary">
                <div className="card">
                  <div className="card__header">
                    <div className="card__title">Theo ngày</div>
                  </div>
                  <div className="table-wrap dd-table-wrap">
                    <table className="table table--grid table--compact table--wrap-head">
                      <thead>
                        <tr>
                          <th>Ngày</th>
                          <th className="num">Có mặt</th>
                          <th className="num">Có phép</th>
                          <th className="num">Không phép</th>
                          <th className="num">Chưa ĐD</th>
                          <th className="num" title="Trẻ nghỉ buổi sáng theo đơn (buổi chiều tính theo cột Có mặt / Không phép)">
                            Nghỉ sáng
                          </th>
                          <th className="num" title="Trẻ nghỉ buổi chiều theo đơn">
                            Nghỉ chiều
                          </th>
                          {mealCols.map((s) => (
                            <th key={s} className="num" title="Số trẻ ăn bữa này">
                              {MEAL_SESSION_LABELS[s] || s}
                            </th>
                          ))}
                          <th className="num" title="Số trẻ có ăn ít nhất một bữa trong ngày (mỗi trẻ tính 1)">
                            Trẻ có ăn
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading || !summary ? (
                          <SkeletonRows rows={5} cols={8} />
                        ) : summary.days.length === 0 ? (
                          <tr>
                            <td colSpan={8 + mealCols.length}>
                              <EmptyState title="Không có dữ liệu trong khoảng đã chọn" description="Chọn khoảng ngày khác có ngày học." />
                            </td>
                          </tr>
                        ) : (
                          paginate(summary.days, page, pageSize).map((d) => (
                            <tr key={d.date}>
                              <td className="nowrap">
                                <span className="muted text-xs dd-weekday">{weekday(d.date)}</span> {formatDate(d.date)}
                              </td>
                              <td className="num fw-600">{d.present}</td>
                              <td className="num">{d.excused}</td>
                              <td className={`num ${d.unexcused ? 'text-danger' : ''}`}>{d.unexcused}</td>
                              <td className="num muted">{d.missing || '—'}</td>
                              <td className="num">{d.morningOff ?? 0}</td>
                              <td className="num">{d.afternoonOff ?? 0}</td>
                              {mealCols.map((s) => (
                                <td key={s} className="num">
                                  {mealCount(d.meals, s)}
                                </td>
                              ))}
                              <td className="num">{d.mealTotal}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {/* Dòng tổng cả khoảng: số suất từng bữa (cộng các ngày), đối chiếu Sổ suất ăn */}
                      {summary?.days.length > 0 && (
                        <tfoot>
                          <tr className="fw-600">
                            <td>Tổng</td>
                            <td className="num">{totals.present}</td>
                            <td className="num">{totals.excused}</td>
                            <td className="num">{totals.unexcused}</td>
                            <td className="num">{summary.days.reduce((t, d) => t + (d.missing || 0), 0)}</td>
                            <td className="num">{summary.days.reduce((t, d) => t + (d.morningOff || 0), 0)}</td>
                            <td className="num">{summary.days.reduce((t, d) => t + (d.afternoonOff || 0), 0)}</td>
                            {mealCols.map((s) => (
                              <td key={s} className="num">
                                {summary.days.some((d) => d.meals?.[s] == null) ? '—' : summary.days.reduce((t, d) => t + d.meals[s], 0)}
                              </td>
                            ))}
                            <td className="num">{totals.meals}</td>
                          </tr>
                        </tfoot>
                      )}
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

                {multi ? (
                  <div className="card">
                    <div className="card__header">
                      <div className="card__title">Theo lớp</div>
                    </div>
                    <div className="table-wrap dd-table-wrap">
                      <table className="table table--grid table--compact table--wrap-head">
                        <thead>
                          <tr>
                            <th>Lớp</th>
                            {!campusId && <th>Điểm trường</th>}
                            <th className="num">Sĩ số</th>
                            <th className="num">Có mặt</th>
                            <th className="num">Có phép</th>
                            <th className="num">Không phép</th>
                            <th className="num" title="Mỗi trẻ có ăn 1 lượt/ngày; số suất theo bữa xem ở Sổ suất ăn">
                              Lượt trẻ ăn
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading || !summary ? (
                            <SkeletonRows rows={5} cols={campusId ? 6 : 7} />
                          ) : summary.classes.length === 0 ? (
                            <tr>
                              <td colSpan={campusId ? 6 : 7}>
                                <EmptyState title="Không có lớp trong phạm vi đã chọn" />
                              </td>
                            </tr>
                          ) : (
                            summary.classes.map((c) => (
                              // Bấm một lớp để xem chi tiết lớp đó (theo trẻ)
                              <tr
                                key={c.classId}
                                className="dd-hov__row"
                                onClick={() => setParams(query({ classId: c.classId }), { replace: true })}
                              >
                                <td className="nowrap">
                                  <button
                                    type="button"
                                    className="link-btn fw-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setParams(query({ classId: c.classId }), { replace: true });
                                    }}
                                  >
                                    {c.className}
                                  </button>
                                </td>
                                {!campusId && <td className="nowrap">{campusName(c.campusId)}</td>}
                                <td className="num">{c.size}</td>
                                <td className="num fw-600">{c.present}</td>
                                <td className="num">{c.excused}</td>
                                <td className={`num ${c.unexcused ? 'text-danger' : ''}`}>{c.unexcused}</td>
                                <td className="num">{c.meals}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="card">
                    <div className="card__header">
                      <div className="card__title">Theo trẻ</div>
                    </div>
                    <div className="table-wrap dd-table-wrap">
                      <table className="table table--grid table--compact table--wrap-head">
                        <thead>
                          <tr>
                            <th>Trẻ</th>
                            <th className="num" title="Nghỉ nửa buổi tính 0,5 ngày (dùng cho chuyên cần, bé chăm)">
                              Ngày có mặt
                            </th>
                            <th className="num">Có phép</th>
                            <th className="num">Không phép</th>
                            <th className="num">Nghỉ sáng</th>
                            <th className="num">Nghỉ chiều</th>
                            {mealCols.map((s) => (
                              <th key={s} className="num" title="Số ngày trẻ ăn bữa này">
                                {MEAL_SESSION_LABELS[s] || s}
                              </th>
                            ))}
                            <th className="num" title="Số ngày trẻ có ăn ít nhất một bữa">
                              Ngày có ăn
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {loading || !summary ? (
                            <SkeletonRows rows={5} cols={7} />
                          ) : summary.children.length === 0 ? (
                            <tr>
                              <td colSpan={7 + mealCols.length}>
                                <EmptyState title="Lớp chưa có trẻ" />
                              </td>
                            </tr>
                          ) : (
                            summary.children.map((c) => (
                              <tr key={c.child.id}>
                                <td>{c.child.fullName}</td>
                                <td className="num fw-600">{days(c.attendedDays ?? c.present)}</td>
                                <td className="num">{c.excused}</td>
                                <td className={`num ${c.unexcused ? 'text-danger' : ''}`}>{c.unexcused}</td>
                                <td className="num">{c.morningOff ?? 0}</td>
                                <td className="num">{c.afternoonOff ?? 0}</td>
                                {mealCols.map((s) => (
                                  <td key={s} className="num">
                                    {mealCount(c.mealCounts, s)}
                                  </td>
                                ))}
                                <td className="num">{c.meals}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
