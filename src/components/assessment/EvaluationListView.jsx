import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileCheck2, Flag, RotateCcw } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAssessmentClasses, useEvaluations } from '@/hooks/assessment/useAssessment';
import { useFilterParams } from '@/hooks/useFilterParams';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { RowActions } from '@/components/ui/RowActions';
import { ChildNameCell, childOfRow } from '@/components/assessment/ChildNameCell';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { FilterMore } from '@/components/ui/FilterMore';
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
  // Mặc định xem tuần gần nhất (cả năm có ~35 tuần): chọn chủ đề rồi tuần, hoặc bấm ‹ › để lùi / tới.
  // Bộ lọc lưu trên URL để mở đánh giá rồi Back vẫn giữ; period '' = tự chọn kỳ mới nhất
  const defaultPeriodType = yearEnd ? '' : PERIOD_TYPE.WEEK;
  const [f, setFilters, , activeKeys] = useFilterParams({
    tab: leader ? 'ALL' : 'TODO',
    classId: '',
    periodType: defaultPeriodType,
    theme: '',
    period: '',
    keyword: '',
  });
  const { tab, classId, periodType, theme, keyword } = f;
  const period = f.period || null;
  const [page, setPage] = useState(1);
  const applyFilters = (patch) => {
    setFilters(patch);
    setPage(1);
  };
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
  const pickPeriod = (key) => applyFilters({ period: key || '' });
  const themeGroups = themes.length && !theme;

  const tabs = leader ? [] : TEACHER_TABS;
  const current = tabs.find((t) => t.key === tab);
  const base = evaluations
    .filter((e) => yearEnd || activePeriod === 'ALL' || `${e.periodType}|${e.periodStart}` === activePeriod)
    .filter((e) => !keyword || normalizeText(`${e.childName} ${e.childCode}`).includes(normalizeText(keyword)));
  const rows = current ? base.filter(current.match) : base;
  // Tab (Chờ xem xét / Đã xác nhận) không phải bộ lọc: đặt lại giữ nguyên tab
  const reset = () => applyFilters({ classId: '', periodType: defaultPeriodType, theme: '', period: '', keyword: '' });
  const filterKeys = activeKeys.filter((k) => k !== 'tab');
  const filtered = filterKeys.length > 0;
  const periodWord = periodType === PERIOD_TYPE.WEEK ? 'tuần' : 'tháng';
  const chipLabels = {
    keyword: `Từ khóa: ${keyword}`,
    classId: `Lớp: ${classes.find((c) => String(c.id) === classId)?.name || classId}`,
    periodType: periodType === PERIOD_TYPE.MONTH ? 'Theo tháng' : 'Theo tuần',
    theme: `Chủ đề: ${theme}`,
    period: period === 'ALL' ? `Tất cả ${periodWord}` : allPeriods.find((p) => p.key === period)?.label || 'Kỳ đã chọn',
  };
  const chipPatch = {
    keyword: { keyword: '' },
    classId: { classId: '' },
    periodType: { periodType: defaultPeriodType, theme: '', period: '' },
    theme: { theme: '', period: '' },
    period: { period: '' },
  };
  const chips = filterKeys.map((k) => ({ key: k, label: chipLabels[k], onRemove: () => applyFilters(chipPatch[k]) }));
  // Hiệu trưởng xem tuần / tháng có đủ 5 ô lọc: loại kỳ và chủ đề gom vào "Lọc thêm"
  const moreFilters = leader && !yearEnd;
  const moreCount = filterKeys.filter((k) => k === 'periodType' || k === 'theme').length;
  const inField = (label, control) =>
    control && (
      <label className="field">
        <span className="field__label">{label}</span>
        {control}
      </label>
    );
  const periodTypeSelect = !yearEnd && (
    <select
      className="select"
      value={periodType}
      onChange={(e) => applyFilters({ periodType: e.target.value, theme: '', period: '' })}
      aria-label="Loại kỳ"
    >
      <option value={PERIOD_TYPE.WEEK}>Theo tuần</option>
      <option value={PERIOD_TYPE.MONTH}>Theo tháng</option>
    </select>
  );
  const themeSelect = !yearEnd && periodType === PERIOD_TYPE.WEEK && themes.length > 0 && (
    <select className="select" value={theme} onChange={(e) => applyFilters({ theme: e.target.value, period: '' })} aria-label="Chủ đề">
      <option value="">Tất cả chủ đề</option>
      {themes.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
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
                onClick={() => applyFilters({ tab: t.key })}
              >
                {t.label} <span className="tab__count">{base.filter(t.match).length}</span>
              </button>
            ))}
          </div>
        )}
        <div className="filter-bar">
          <SearchSubmit
            className="flex-1"
            value={keyword}
            placeholder="Tìm tên hoặc mã trẻ"
            label="Tìm trẻ"
            onSearch={(text) => applyFilters({ keyword: text })}
          />
          {showClass && (
            <select className="select" value={classId} onChange={(e) => applyFilters({ classId: e.target.value })} aria-label="Lớp">
              <option value="">Tất cả lớp</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {!moreFilters && periodTypeSelect}
          {!moreFilters && themeSelect}
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
          {moreFilters && (
            <FilterMore count={moreCount}>
              {inField('Loại kỳ', periodTypeSelect)}
              {inField('Chủ đề', themeSelect)}
            </FilterMore>
          )}
          <button className="btn" onClick={reset} disabled={!filtered}>
            <RotateCcw size={15} /> Đặt lại bộ lọc
          </button>
        </div>
        <FilterChips count={loading ? null : rows.length} unit="đánh giá" chips={chips} />
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="table table--grid">
              <thead>
                <tr>
                  <th>Trẻ</th>
                  {showClass && <th>Lớp</th>}
                  <th>Kỳ đánh giá</th>
                  {showFlags && <th className="center">Cờ bé ngoan</th>}
                  <th className="center">Trạng thái</th>
                  <th>Cập nhật</th>
                  <th className="cell--actions">Thao tác</th>
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
                          <ChildNameCell child={childOfRow(e)} />
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
                        <td className="center">
                          <EvaluationStatusBadge status={e.status} />
                        </td>
                        <td className="nowrap text-sm">
                          {formatDateTime(e.confirmedAt || e.aiDraft?.generatedAt || e.history.at(-1)?.at)}
                        </td>
                        <td className="cell--actions" onClick={(ev) => ev.stopPropagation()}>
                          {todo ? (
                            <button className="btn btn--primary btn--sm" onClick={() => navigate(link(e))}>
                              <FileCheck2 size={15} /> Xem xét
                            </button>
                          ) : (
                            <RowActions view={{ to: link(e), label: 'Xem đánh giá' }} name={e.childName} />
                          )}
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
