import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, FileCheck2, Flag, RotateCcw, Search } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAssessmentClasses, useEvaluations } from '@/hooks/assessment/useAssessment';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EvaluationStatusBadge } from '@/components/assessment/AssessmentBadges';
import { EVAL_KIND, EVAL_STATUS, PERIOD_TYPE, PERIOD_TYPE_LABELS } from '@/models/assessment/assessmentConstants';
import { formatDateTime, normalizeText } from '@/utils/format';
import { evaluationPeriodLabel } from '@/utils/assessment/assessmentPeriods';
import { isLeader } from '@/utils/assessment/assessmentPermissions';

const TEACHER_TABS = [
  { key: 'TODO', label: 'Chờ xem xét', match: (e) => e.status !== EVAL_STATUS.CONFIRMED },
  { key: EVAL_STATUS.CONFIRMED, label: 'Đã xác nhận', match: (e) => e.status === EVAL_STATUS.CONFIRMED },
  { key: 'ALL', label: 'Tất cả', match: () => true },
];

/** Shared list of #55 Periodic Evaluation List and #58 Year-end Evaluation List. */
export function EvaluationListView({ kind }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const leader = isLeader(user);
  const { schoolYear } = useSchoolYear();
  const yearEnd = kind === EVAL_KIND.YEAR_END;
  const { classes } = useAssessmentClasses();
  const [classId, setClassId] = useState('');
  // Mặc định xem tuần gần nhất (cả năm có ~35 tuần): chọn chủ đề rồi tuần, hoặc bấm ‹ › để lùi / tới
  const [periodType, setPeriodType] = useState(yearEnd ? '' : PERIOD_TYPE.WEEK);
  const [theme, setTheme] = useState('');
  const [period, setPeriod] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState(leader ? 'ALL' : 'TODO');
  const [page, setPage] = useState(1);
  const filters = useMemo(
    () => ({ classId: classId || undefined, schoolYear, periodType: periodType || undefined }),
    [classId, schoolYear, periodType],
  );
  const { evaluations, loading, error, reload } = useEvaluations(kind, filters);

  // Các kỳ có đánh giá, mới nhất trước; tuần ghi như giáo án (Tuần N của năm học) kèm chủ đề
  const allPeriods = useMemo(() => {
    const map = new Map();
    evaluations.forEach((e) => {
      const key = `${e.periodType}|${e.periodStart}`;
      if (!map.has(key)) map.set(key, { key, start: e.periodStart, label: evaluationPeriodLabel(e), theme: e.themeName || '' });
    });
    return [...map.values()].sort((a, b) => b.start.localeCompare(a.start));
  }, [evaluations]);
  const themes = [...new Set(allPeriods.map((p) => p.theme).filter(Boolean))];
  const periods = allPeriods.filter((p) => !theme || p.theme === theme);
  // null = tự chọn kỳ mới nhất trong danh sách; 'ALL' = mọi kỳ
  const activePeriod = period === null ? periods[0]?.key || 'ALL' : period;
  const periodIndex = periods.findIndex((p) => p.key === activePeriod);
  const pickPeriod = (key) => {
    setPeriod(key);
    setPage(1);
  };
  const themeGroups = themes.length && !theme;

  const tabs = leader ? [] : TEACHER_TABS;
  const current = tabs.find((t) => t.key === tab);
  const base = evaluations
    .filter((e) => yearEnd || activePeriod === 'ALL' || `${e.periodType}|${e.periodStart}` === activePeriod)
    .filter((e) => !keyword || normalizeText(`${e.childName} ${e.childCode}`).includes(normalizeText(keyword)));
  const rows = current ? base.filter(current.match) : base;
  const reset = () => {
    setClassId('');
    setPeriodType(yearEnd ? '' : PERIOD_TYPE.WEEK);
    setTheme('');
    setPeriod(null);
    setKeyword('');
    setPage(1);
  };
  const filtered = classId || (!yearEnd && periodType !== PERIOD_TYPE.WEEK) || theme || period !== null || keyword;
  // Giáo viên chỉ dạy 1 lớp (mỗi lớp 2 cô): bỏ lọc và cột Lớp; đánh giá tuần / tháng hiện số cờ bé ngoan của kỳ
  const showClass = leader;
  const showFlags = !leader && !yearEnd;
  const cols = 5 + (showClass ? 1 : 0) + (showFlags ? 1 : 0);
  const link = (e) => `/assessment/${yearEnd ? 'year-end' : 'periodic'}/${e.id}`;

  return (
    <>
      <div className="card">
        {tabs.length > 0 && (
          <div className="tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`tab ${tab === t.key ? 'tab--active' : ''}`}
                onClick={() => {
                  setTab(t.key);
                  setPage(1);
                }}
              >
                {t.label} <span className="tab__count">{base.filter(t.match).length}</span>
              </button>
            ))}
          </div>
        )}
        <div className="filter-bar" style={{ flexWrap: 'wrap' }}>
          <label className="search-box" style={{ flex: 1, minWidth: 200 }}>
            <Search size={17} className="muted" />
            <input
              placeholder="Tìm tên hoặc mã trẻ..."
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              aria-label="Tìm trẻ"
            />
          </label>
          {showClass && (
            <select
              className="select"
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setPage(1);
              }}
              aria-label="Lớp"
            >
              <option value="">Tất cả lớp</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {!yearEnd && (
            <select
              className="select"
              value={periodType}
              onChange={(e) => {
                setPeriodType(e.target.value);
                setTheme('');
                pickPeriod(null);
              }}
              aria-label="Loại kỳ"
            >
              <option value={PERIOD_TYPE.WEEK}>Theo tuần</option>
              <option value={PERIOD_TYPE.MONTH}>Theo tháng</option>
            </select>
          )}
          {!yearEnd && periodType === PERIOD_TYPE.WEEK && themes.length > 0 && (
            <select
              className="select"
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value);
                pickPeriod(null);
              }}
              aria-label="Chủ đề"
            >
              <option value="">Tất cả chủ đề</option>
              {themes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          {!yearEnd && (
            <div className="dg-period-nav">
              <button
                type="button"
                className="icon-btn"
                aria-label={periodType === PERIOD_TYPE.WEEK ? 'Tuần trước' : 'Tháng trước'}
                title={periodType === PERIOD_TYPE.WEEK ? 'Tuần trước' : 'Tháng trước'}
                disabled={periodIndex < 0 || periodIndex >= periods.length - 1}
                onClick={() => pickPeriod(periods[periodIndex + 1].key)}
              >
                <ChevronLeft size={16} />
              </button>
              <select className="select" value={activePeriod} onChange={(e) => pickPeriod(e.target.value)} aria-label="Kỳ đánh giá">
                <option value="ALL">{periodType === PERIOD_TYPE.WEEK ? 'Tất cả tuần' : 'Tất cả tháng'}</option>
                {themeGroups
                  ? themes.map((t) => (
                      <optgroup key={t} label={`Chủ đề: ${t}`}>
                        {periods
                          .filter((p) => p.theme === t)
                          .map((p) => (
                            <option key={p.key} value={p.key}>
                              {p.label}
                            </option>
                          ))}
                      </optgroup>
                    ))
                  : null}
                {(themeGroups ? periods.filter((p) => !p.theme) : periods).map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="icon-btn"
                aria-label={periodType === PERIOD_TYPE.WEEK ? 'Tuần sau' : 'Tháng sau'}
                title={periodType === PERIOD_TYPE.WEEK ? 'Tuần sau' : 'Tháng sau'}
                disabled={periodIndex <= 0}
                onClick={() => pickPeriod(periods[periodIndex - 1].key)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          <button className="btn" onClick={reset} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại
          </button>
        </div>
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderTop: '1px solid var(--border)', borderRadius: 0 }}>
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Trẻ</th>
                  {showClass && <th>Lớp</th>}
                  <th>Kỳ đánh giá</th>
                  {showFlags && <th className="center">Cờ bé ngoan</th>}
                  <th>Trạng thái</th>
                  <th>Cập nhật</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows rows={5} cols={cols} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={cols}>
                      <EmptyState
                        icon={FileCheck2}
                        title={filtered ? 'Không có đánh giá phù hợp' : 'Chưa có đánh giá'}
                        description={
                          filtered
                            ? 'Không có hồ sơ nào trong phạm vi hoặc kỳ đã chọn.'
                            : yearEnd
                              ? 'Bản nháp cuối năm được tạo khi năm học kết thúc.'
                              : 'Bản nháp được tạo tự động khi tuần hoặc tháng kết thúc.'
                        }
                        action={
                          filtered && (
                            <button className="btn" onClick={reset}>
                              <RotateCcw size={15} /> Đặt lại bộ lọc
                            </button>
                          )
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  paginate(rows, page).map((e) => {
                    const todo = !leader && e.status !== EVAL_STATUS.CONFIRMED;
                    return (
                      <tr key={e.id} className="row-click" onClick={() => navigate(link(e))}>
                        <td>
                          <div className="fw-600">{e.childName}</div>
                          <div className="muted text-xs">{e.childCode}</div>
                        </td>
                        {showClass && <td>{e.className}</td>}
                        <td className="nowrap">
                          <div>{evaluationPeriodLabel(e)}</div>
                          <div className="muted text-xs">{e.themeName ? `Chủ đề: ${e.themeName}` : PERIOD_TYPE_LABELS[e.periodType]}</div>
                        </td>
                        {showFlags && (
                          <td className="center">
                            <span className="dg-flag-count">
                              <Flag size={14} aria-hidden="true" /> {e.flagCount ?? 0}
                            </span>
                          </td>
                        )}
                        <td>
                          <EvaluationStatusBadge status={e.status} />
                        </td>
                        <td className="nowrap text-sm">
                          {formatDateTime(e.confirmedAt || e.aiDraft?.generatedAt || e.history.at(-1)?.at)}
                        </td>
                        <td className="center" onClick={(ev) => ev.stopPropagation()}>
                          <button className={`btn btn--sm ${todo ? 'btn--primary' : ''}`} onClick={() => navigate(link(e))}>
                            {todo ? <FileCheck2 size={15} /> : <Eye size={15} />} {todo ? 'Xem xét' : 'Xem'}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && <Pagination page={page} total={rows.length} onChange={setPage} unit="đánh giá" />}
      </div>
    </>
  );
}
