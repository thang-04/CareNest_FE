import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileCheck2, Flag, RotateCcw } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useDailyAssessmentClasses, useEvaluations } from '@/hooks/assessment/useAssessment';
import { useAsync } from '@/hooks/useAsync';
import { useFilterParams } from '@/hooks/useFilterParams';
import { SCHOOL_CONFIG_API } from '@/config/env';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/ui/States';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { Tabs } from '@/components/ui/Tabs';
import { clickableRowProps } from '@/utils/clickableRow';
import { ChildNameCell, childOfRow } from '@/components/assessment/ChildNameCell';
import { SearchSubmit } from '@/components/ui/SearchSubmit';
import { FilterChips } from '@/components/ui/FilterChips';
import { FilterMore } from '@/components/ui/FilterMore';
import { CampusFilter } from '@/components/ui/CampusFilter';
import { EvaluationStatusBadge } from '@/components/assessment/AssessmentBadges';
import { ClassMonthlyCommentCard } from '@/components/assessment/ClassMonthlyCommentCard';
import { EVAL_KIND, EVAL_STATUS, PERIOD_TYPE, PERIOD_TYPE_LABELS } from '@/models/assessment/assessmentConstants';
import { formatDateTime, normalizeText } from '@/utils/format';
import { evaluationPeriodLabel } from '@/utils/assessment/assessmentPeriods';
import { isLeader, isTeamLeader } from '@/utils/assessment/assessmentPermissions';
import { getDailyAssessmentClasses, getThemeClasses } from '@/services/assessment/assessmentService';
import { getCampuses } from '@/services/masterDataService';
import { getAgeGroups } from '@/services/schoolService';
import { monthInSemester, semestersOf } from '@/utils/semesters';
import { SemesterSelect } from '@/components/form/SemesterSelect';

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
  const { schoolYear, schoolYears } = useSchoolYear();
  const yearEnd = kind === EVAL_KIND.YEAR_END;
  const pickYearEndClass = yearEnd && (leader || isTeamLeader(user));
  const { classes } = useDailyAssessmentClasses({ enabled: !pickYearEndClass });
  const { data: ageGroups } = useAsync(getAgeGroups, [user?.id], { enabled: pickYearEndClass });
  const classScope = useAsync(
    () => (SCHOOL_CONFIG_API ? getThemeClasses({ schoolYear }, user) : getDailyAssessmentClasses(schoolYear, user)),
    [schoolYear, user?.id],
    { enabled: pickYearEndClass },
  );
  const { data: campuses } = useAsync(() => getCampuses(user), [user?.id], { enabled: yearEnd && leader });
  // Đánh giá định kỳ chỉ theo tháng (Cần 30/10/2026, theo sổ chỉ đạo chuyên môn: tháng và học kỳ, bỏ tuần).
  // Mặc định xem tháng gần nhất, bấm ‹ › để lùi / tới. Bộ lọc lưu trên URL; period '' = tự chọn kỳ mới nhất
  const semester = kind === EVAL_KIND.SEMESTER;
  const defaultPeriodType = yearEnd ? '' : semester ? PERIOD_TYPE.SEMESTER : PERIOD_TYPE.MONTH;
  const [f, setFilters, , activeKeys] = useFilterParams({
    tab: leader || pickYearEndClass ? 'ALL' : 'TODO',
    ...(pickYearEndClass && { campusId: '', ageGroupId: '' }),
    classId: '',
    periodType: defaultPeriodType,
    theme: '',
    period: '',
    keyword: '',
    sem: '',
  });
  const { tab, classId, theme, keyword, campusId = '', ageGroupId = '' } = f;
  const scopedClasses = classScope.data || [];
  const campusOptions = (campuses || []).filter((c) => scopedClasses.some((cls) => String(cls.campusId) === String(c.id)));
  const campusName = (id) => campusOptions.find((c) => String(c.id) === String(id))?.name;
  const campusClasses = scopedClasses.filter((c) => !campusId || String(c.campusId) === campusId);
  const groupOptions = (ageGroups || []).filter((g) => campusClasses.some((c) => String(c.ageGroupId) === String(g.id)));
  const classOptions = campusClasses.filter((c) => !ageGroupId || String(c.ageGroupId) === ageGroupId);
  // Tổ trưởng / GV vào thẳng lớp mình đang dạy (Cần chốt 10/11/2026); HT, PHT vẫn tự chọn điểm trường, lớp
  const ownClass =
    pickYearEndClass && !leader ? classOptions.find((c) => c.teaches) || (classOptions.length === 1 ? classOptions[0] : null) : null;
  const shownClassId = classId || (ownClass ? String(ownClass.classId ?? ownClass.id) : '');
  const selectedClass = classOptions.find((c) => String(c.classId ?? c.id) === shownClassId);
  const evaluationClassId = pickYearEndClass ? (selectedClass?.classId ?? selectedClass?.id) : classId;
  const yearEndReadOnly = pickYearEndClass && (leader || (SCHOOL_CONFIG_API && !selectedClass?.teaches));
  const periodType = defaultPeriodType;
  const period = f.period || null;
  const [page, setPage] = useState(1);
  const applyFilters = (patch) => {
    setFilters(patch);
    setPage(1);
  };
  const filters = useMemo(
    () => ({ classId: evaluationClassId || undefined, schoolYear, periodType: periodType || undefined }),
    [evaluationClassId, schoolYear, periodType],
  );
  const { evaluations, loading, error, reload } = useEvaluations(kind, filters, { enabled: !pickYearEndClass || !!selectedClass });

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
  // Đánh giá tháng: lọc các tháng theo học kỳ (Cấu hình thời gian)
  // Đánh giá tháng: lọc theo học kỳ của năm học đang chọn ở đầu trang (lưu key trên URL, ngày lấy theo năm hiện tại)
  const semKey = f.sem;
  const sem = semestersOf(schoolYears.find((y) => String(y.id) === String(schoolYear))).find((x) => x.key === semKey) || null;
  const monthly = !yearEnd && !semester;
  const inSem = (start) => !monthly || monthInSemester(start.slice(0, 7), sem);
  const periods = allPeriods.filter((p) => (!theme || p.theme === theme) && inSem(p.start));
  // null = tự chọn kỳ mới nhất trong danh sách; 'ALL' = mọi kỳ
  const activePeriod = period === null ? periods[0]?.key || 'ALL' : period;
  const periodIndex = periods.findIndex((p) => p.key === activePeriod);
  const pickPeriod = (key) => applyFilters({ period: key || '' });
  const themeGroups = themes.length && !theme;

  const tabs = leader || yearEndReadOnly || (pickYearEndClass && !selectedClass) ? [] : TEACHER_TABS;
  const current = tabs.find((t) => t.key === tab);
  const base = evaluations
    .filter((e) => yearEnd || activePeriod === 'ALL' || `${e.periodType}|${e.periodStart}` === activePeriod)
    .filter((e) => inSem(e.periodStart))
    .filter((e) => !keyword || normalizeText(`${e.childName} ${e.childCode}`).includes(normalizeText(keyword)));
  const rows = current ? base.filter(current.match) : base;
  // Tab (Chờ xem xét / Đã xác nhận) không phải bộ lọc: đặt lại giữ nguyên tab
  const reset = () =>
    applyFilters({ classId: '', campusId: '', ageGroupId: '', periodType: defaultPeriodType, theme: '', period: '', keyword: '', sem: '' });
  const filterKeys = activeKeys.filter((k) => k !== 'tab' && k !== 'periodType');
  const filtered = filterKeys.length > 0;
  const periodWord = { [PERIOD_TYPE.WEEK]: 'tuần', [PERIOD_TYPE.SEMESTER]: 'học kỳ' }[periodType] || 'tháng';
  const PeriodWord = periodWord.charAt(0).toUpperCase() + periodWord.slice(1);
  const chipLabels = {
    sem: sem ? sem.label : '',
    keyword: `Từ khóa: ${keyword}`,
    campusId: `Điểm trường: ${campusName(campusId) || campusId}`,
    ageGroupId: `Nhóm tuổi: ${(ageGroups || []).find((g) => String(g.id) === ageGroupId)?.name || ageGroupId}`,
    classId: `Lớp: ${selectedClass?.name || classes.find((c) => String(c.id) === classId)?.name || classId}`,
    periodType: periodType === PERIOD_TYPE.MONTH ? 'Theo tháng' : 'Theo tuần',
    theme: `Chủ đề: ${theme}`,
    period: period === 'ALL' ? `Tất cả ${periodWord}` : allPeriods.find((p) => p.key === period)?.label || 'Kỳ đã chọn',
  };
  const chipPatch = {
    keyword: { keyword: '' },
    campusId: { campusId: '', ageGroupId: '', classId: '' },
    ageGroupId: { ageGroupId: '', classId: '' },
    classId: { classId: '' },
    periodType: { periodType: defaultPeriodType, theme: '', period: '' },
    theme: { theme: '', period: '' },
    period: { period: '' },
    sem: { sem: '', period: '' },
  };
  const chips = filterKeys.map((k) => ({ key: k, label: chipLabels[k], onRemove: () => applyFilters(chipPatch[k]) }));
  // Hiệu trưởng xem tuần / tháng có đủ 5 ô lọc: loại kỳ và chủ đề gom vào "Lọc thêm"
  const moreCount = filterKeys.filter((k) => k === 'periodType' || k === 'theme').length;
  const inField = (label, control) =>
    control && (
      <label className="field">
        <span className="field__label">{label}</span>
        {control}
      </label>
    );
  // Chỉ còn loại kỳ Tháng: không cần ô chọn loại kỳ
  const periodTypeSelect = null;
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
  // Khai báo sau themeSelect (dùng themeSelect)
  const moreFilters = leader && !yearEnd && !!themeSelect;
  // Giáo viên chỉ dạy 1 lớp (mỗi lớp 2 cô): bỏ lọc và cột Lớp; đánh giá tuần / tháng hiện số cờ bé ngoan của kỳ
  // Tổ trưởng (GV) thấy đánh giá cuối năm của nhiều lớp trong tổ: hiện cột và ô lọc Lớp như BGH
  const showClass = leader || !!classId || new Set(evaluations.map((e) => e.classId)).size > 1;
  const showFlags = !leader && !yearEnd;
  // Cột Thao tác chỉ có nút "Xem xét" của giáo viên; tổ trưởng trở lên chỉ xem nên không có cột này
  const showActions = !leader;
  const cols = 4 + (showClass ? 1 : 0) + (showFlags ? 1 : 0) + (showActions ? 1 : 0);
  const link = (e) => `/assessment/${kind}/${e.id}`;

  // Đánh giá tháng: nhận xét chung của lớp cho tháng đang xem (GV lớp mình; BGH khi đã chọn lớp)
  const monthKey = !yearEnd && !semester && activePeriod !== 'ALL' ? activePeriod.split('|')[1] : null;
  const commentClassId = leader ? classId : classes.find((c) => c.teaches)?.id || classes[0]?.id;

  return (
    <>
      {monthKey && commentClassId && <ClassMonthlyCommentCard classId={commentClassId} month={monthKey} />}
      <div className="card">
        {tabs.length > 0 && (
          <Tabs
            items={tabs.map((t) => ({ key: t.key, label: t.label, count: base.filter(t.match).length }))}
            value={tab}
            onChange={(key) => applyFilters({ tab: key })}
            ariaLabel="Lọc theo trạng thái"
          />
        )}
        <div className="filter-bar">
          {pickYearEndClass && (
            <>
              <CampusFilter
                campuses={campusOptions}
                value={campusId}
                onChange={(value) => applyFilters({ campusId: value, ageGroupId: '', classId: '' })}
              />
              {(groupOptions.length > 1 || !!ageGroupId) &&
                inField(
                  'Nhóm tuổi',
                  <select
                    className="select"
                    aria-label="Nhóm tuổi"
                    value={ageGroupId}
                    onChange={(e) => applyFilters({ ageGroupId: e.target.value, classId: '' })}
                  >
                    <option value="">Tất cả nhóm tuổi</option>
                    {groupOptions.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>,
                )}
              {inField(
                'Lớp',
                <select
                  className="select"
                  aria-label="Lớp"
                  value={selectedClass ? shownClassId : ''}
                  disabled={classScope.loading || !classOptions.length}
                  onChange={(e) => applyFilters({ classId: e.target.value, tab: 'ALL' })}
                >
                  <option value="">Chọn lớp</option>
                  {classOptions.map((c) => (
                    <option key={c.classId ?? c.id} value={c.classId ?? c.id}>
                      {c.name}
                      {!campusId && campusOptions.length > 1 && campusName(c.campusId) ? ` · ${campusName(c.campusId)}` : ''}
                      {!leader && c.teaches === false ? ' (chỉ xem)' : ''}
                    </option>
                  ))}
                </select>,
              )}
            </>
          )}
          <SearchSubmit
            className="flex-1"
            value={keyword}
            placeholder="Tìm tên hoặc mã trẻ"
            label="Tìm trẻ"
            onSearch={(text) => applyFilters({ keyword: text })}
          />
          {showClass && !pickYearEndClass && (
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
          {monthly && <SemesterSelect value={semKey} onChange={(key) => applyFilters({ sem: key, period: '' })} />}
          {!yearEnd && (
            <div className="dg-period-nav">
              <button
                type="button"
                className="icon-btn"
                aria-label={`${PeriodWord} trước`}
                title={`${PeriodWord} trước`}
                disabled={periodIndex < 0 || periodIndex >= periods.length - 1}
                onClick={() => pickPeriod(periods[periodIndex + 1].key)}
              >
                <ChevronLeft size={16} />
              </button>
              <select className="select" value={activePeriod} onChange={(e) => pickPeriod(e.target.value)} aria-label="Kỳ đánh giá">
                <option value="ALL">Tất cả {periodWord}</option>
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
                aria-label={`${PeriodWord} sau`}
                title={`${PeriodWord} sau`}
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
        <FilterChips count={loading || (pickYearEndClass && !selectedClass) ? null : rows.length} unit="đánh giá" chips={chips} />
        {classScope.error ? (
          <ErrorState error={classScope.error} onRetry={classScope.reload} />
        ) : pickYearEndClass && !classScope.loading && !selectedClass ? (
          <EmptyState
            icon={FileCheck2}
            title={classOptions.length ? 'Chọn lớp để xem đánh giá cuối năm' : 'Không có lớp trong phạm vi đã chọn'}
            description="Danh sách đánh giá hiển thị theo lớp và năm học đang chọn."
          />
        ) : error ? (
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
                  {showActions && <th className="cell--actions">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {loading || classScope.loading ? (
                  <SkeletonRows rows={5} cols={cols} />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={cols}>
                      <EmptyState
                        icon={FileCheck2}
                        title={filtered ? 'Không có đánh giá phù hợp' : 'Chưa có đánh giá'}
                        description={
                          yearEndReadOnly && !keyword
                            ? 'Lớp chưa có đánh giá cuối năm đã xác nhận.'
                            : filtered
                              ? 'Không có hồ sơ nào trong phạm vi hoặc kỳ đã chọn.'
                              : yearEnd
                                ? 'Bản nháp cuối năm được tạo khi học kỳ II kết thúc.'
                                : semester
                                  ? 'Bản nháp được tạo khi học kỳ kết thúc. Nếu học kỳ đã kết thúc mà chưa có, kiểm tra ngày học kỳ ở Cấu hình thời gian.'
                                  : 'Bản nháp được tạo tự động khi tháng kết thúc.'
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
                    const todo = !leader && !yearEndReadOnly && e.status !== EVAL_STATUS.CONFIRMED;
                    return (
                      <tr key={e.id} className="row-click" {...clickableRowProps(() => navigate(link(e)))}>
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
                        {showActions && (
                          <td className="cell--actions" onClick={(ev) => ev.stopPropagation()}>
                            {todo && (
                              <button className="btn btn--primary btn--sm" onClick={() => navigate(link(e))}>
                                <FileCheck2 size={15} /> Xem xét
                              </button>
                            )}
                          </td>
                        )}
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
