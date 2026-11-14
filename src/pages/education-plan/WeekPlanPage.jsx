import { useEffect, useId, useRef, useState } from 'react';
import ActivityCardEditor from '@/components/education-plan/ActivityCardEditor';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ClassFilterBar, FilterSelect, ThemeBranchTabs, themesWithWeeks } from '@/components/education-plan/planUi';
import { BlockedNotice } from '@/components/education-plan/DeadlineWidgets';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ChalkboardTeacher, Copy, FileDown, Save, X } from '@/components/ui/icons';
import { EmptyCard, fmtDate, FoldAllButton, Notice, PageHead } from '@/components/education-plan/eduUi';
import { VersionHistory } from '@/components/education-plan/VersionHistory';
import { docLines } from '@/models/education-plan/planHistory.mjs';
import { useClassPlanContext } from '@/components/education-plan/planUi';
import { ActionsMenu, RejectedNotice } from '@/components/education-plan/reviewUi';
import { themeRowOf } from '@/components/education-plan/ThemePlanBody';
import { numberGoals } from '@/models/education-plan/goalTable';
import { LoadingState } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useManualSave } from '@/hooks/education-plan/useManualSave';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import {
  DAY_SECTIONS,
  WEEKDAY_LABELS,
  branchNumber,
  cardText,
  cardsOf,
  cellKey,
  coverageOf,
  createBlocker,
  dayDraftFromWeek,
  dayGoalsOf,
  ddmm,
  emptyWeekPlan,
  isEditableStatus,
  lessonReuseFor,
  markDayBasis,
  normalizeDay,
  normalizeTheme,
  normalizeWeek,
  prefillDayAims,
  rowCell,
  sectionHasContent,
  themeActivities,
  themeGoalBlocks,
  todayIso,
  weekBaseOf,
  weekDiff,
  yearWeeks,
} from '@/models/education-plan/classPlan';
import { dayPlansFile, leaderNameOf } from '@/utils/education-plan/classPlanDoc';
import { DayTab, WeekTab } from '@/components/education-plan/WeekPlanBody';
import { DayResources } from '@/components/education-plan/DayResources';
import { FinishedThemeNote, SupersededNote, VersionCopyOffer, VersionFlagsPanel } from '@/components/education-plan/VersionWidgets';
import { useDocVersion } from '@/hooks/education-plan/useDocVersion';
import { checkFlag, dropReference, versionOf } from '@/models/education-plan/planVersions.mjs';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';
import { dayKeyOf } from '@/models/education-plan/deadline.mjs';
import { Button } from '@/components';

const DAY_FIELDS = ['days', 'dayGoals', 'dossierCards'];
// Phần kế hoạch tuần sửa được theo hồ sơ chủ đề, lưu ở day.content.week (BE:EDU-79, research R1)
const WEEK_FIELDS = ['aims', 'prep', 'grid', 'picks', 'unlinked', 'corners'];
const without = (doc, keys) => Object.fromEntries(Object.entries(doc).filter(([k]) => !keys.includes(k)));
const only = (doc, keys) => Object.fromEntries(keys.filter((k) => doc?.[k] !== undefined).map((k) => [k, doc[k]]));

/**
 * Spec 003 (Q9): hai trang của một tuần — mode 'week' = Kế hoạch tuần (mục đích, chuẩn bị, bảng hoạt động Thứ 2–6),
 * mode 'days' = Giáo án ngày (5 kế hoạch ngày, mỗi ngày 4 mục + đánh giá trẻ trên ngày — spec 005). Mỗi phần theo trạng thái gói/hồ sơ chứa nó; gửi và
 * duyệt ở gói học kỳ hoặc hồ sơ chủ đề. review = đường dẫn duyệt cũ, chuyển sang trang tuần.
 */
export default function WeekPlanPage({ review = false, mode = 'week' }) {
  const { classId, weekStart } = useParams();
  if (review) return <WeekReviewRedirect />;
  return <WeekPlanInner key={`${classId}/${weekStart}/${mode}`} mode={mode} />;
}

function WeekReviewRedirect() {
  const { classId, weekStart } = useParams();
  const ctx = useClassPlanContext(classId);
  if (ctx.loading) return <LoadingState />;
  const week = ctx.yearPlan ? yearWeeks(ctx.yearPlan).find((w) => w.type === 'week' && w.start === weekStart) : null;
  if (!week) return <StatusPage kind="404" title="Không tìm thấy tuần học này trong kế hoạch năm của lớp" />;
  return <Navigate to={`/education/class/${classId}/weeks/${weekStart}`} replace />;
}

/**
 * dayPage (spec 004): trang Kế hoạch giáo dục ngày — chọn lớp/chủ đề/tuần trên trang, kế hoạch tuần chỉ đọc ở trên làm căn
 * cứ, gửi/duyệt hồ sơ chủ đề (giáo án ngày) ngay trên trang.
 */
export function WeekPlanInner({ mode, classId: classIdProp, weekStart: weekStartProp, dayPage = false }) {
  const tabId = useId();
  const params = useParams();
  const classId = classIdProp ?? params.classId;
  const weekStart = weekStartProp ?? params.weekStart;
  const {
    user,
    weekPlans,
    dayPlans,
    branchPlans,
    classThemePlans,
    themeDossiers,
    semesterPackages,
    saveClassDoc,
    actOnClassDoc,
    toast,
    staff,
  } = useEducationPlan();
  const [confirmRevise, setConfirmRevise] = useState(false);
  const [preview, setPreview] = useState(null);
  // Mục còn trống BE trả khi gửi hồ sơ chủ đề (FR-007a): [{ date, section }], hiện chữ đỏ tới khi sửa xong
  const [emptyErr, setEmptyErr] = useState([]);
  // MT chưa dạy BE trả khi gửi hồ sơ chủ đề (EDU-80, 7396/7397): [{ goalId, goalNo }]
  const [goalErr, setGoalErr] = useState([]);
  const [cardFor, setCardFor] = useState(null);
  // Chỗ DayTab đặt menu "Lấy / gợi ý nội dung" ở trái hàng nút
  const [toolsEl, setToolsEl] = useState(null);
  // Tab tuần ở trang ngày đang sửa được theo hồ sơ chủ đề (tính khi render, đọc lúc lưu)
  const weekEditableRef = useRef({ editable: false }).current;
  const ctx = useClassPlanContext(classId);
  const { cls, classes, yearPlan, canComposeClassDocs } = ctx;
  const savedWeek = weekPlans.find((w) => w.classId === classId && w.yearPlanId === yearPlan?.id && w.weekStart === weekStart) || null;
  const savedDay = dayPlans.find((w) => w.classId === classId && w.yearPlanId === yearPlan?.id && w.weekStart === weekStart) || null;
  // Bản mock cũ chưa tách giáo án ngày: mọi thứ vẫn nằm ở giáo án tuần
  const split = dayPlans.length > 0 || themeDossiers.length > 0;
  const days = mode === 'days';
  const saved = split && days ? savedDay : savedWeek;
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState(days ? '0' : 'week');

  const weeks = yearPlan ? yearWeeks(yearPlan).filter((w) => w.type === 'week') : [];
  const idx = weeks.findIndex((w) => w.start === weekStart);
  const week = weeks[idx];
  const [copying, setCopying] = useState(false);
  const version = useDocVersion('week', saved, ctx, weekPlans, { themeId: week?.theme.id, weekStart, weekNo: week?.no });
  // Nội dung sửa khi Nháp / Bị trả lại trên phiên bản hiện hành
  const contentEditable =
    !ctx.superseded &&
    (saved?.permissions
      ? saved.permissions.canEdit
      : saved
        ? canComposeClassDocs && isEditableStatus(saved.status)
        : ctx.canCreate('week'));

  // Lưu tay (nút Lưu, Ctrl+S); rời trang khi chưa lưu thì hỏi
  const saver = useManualSave({
    doc: draft,
    enabled: contentEditable,
    save: async (doc) => {
      if (!split) return saveClassDoc('week', { ...doc, dayGoals: dayGoalsOf(doc) });
      if (!days) {
        const out = await saveClassDoc('week', without(doc, DAY_FIELDS));
        return out && { ...doc, ...out };
      }
      // EDU-79 (FR-016): kế hoạch tuần đi vào hồ sơ chủ đề chỉ khi đã sửa so với bản theo kỳ
      const schedule = only(doc, WEEK_FIELDS);
      const edited =
        weekEditableRef.editable &&
        (JSON.stringify(schedule) !== JSON.stringify(only(semesterView(), WEEK_FIELDS)) || (doc.dossierCards || []).length > 0);
      const week = weekEditableRef.editable
        ? edited && { ...schedule, cards: doc.dossierCards || [], base: savedDay?.week?.base || weekBaseOf(savedWeek) }
        : savedDay?.week;
      const dayDoc = {
        id: savedDay?.id || dayKeyOf(doc.id),
        classId: doc.classId,
        yearPlanId: doc.yearPlanId,
        themeId: doc.themeId,
        weekStart: doc.weekStart,
        days: doc.days,
        dayGoals: dayGoalsOf(doc, cardsOf(themeDocOf(), { cards: doc.dossierCards })),
        ...(week ? { week } : {}),
        version: savedDay?.version,
      };
      const out = await saveClassDoc('day', dayDoc);
      return out && { ...doc, ...out };
    },
    onSaved: (same) => same && setDirty(false),
    backup: { userId: user?.id, key: `week:${classId}:${weekStart}${versionOf(yearPlan) > 1 ? `:${yearPlan.id}` : ''}` },
    onRestore: (doc) => {
      setDraft(doc);
      setDirty(true);
    },
  });

  const guard = useLeaveGuard({
    when: contentEditable && saver.unsaved,
    onSave: saver.save,
  });

  // Bản theo kỳ của tuần (để so phần sửa theo hồ sơ chủ đề)
  const semesterView = () =>
    normalizeWeek({
      ...emptyWeekPlan({
        classId,
        yearPlanId: yearPlan?.id,
        weekStart,
        weekNo: week?.no,
        themeId: week?.theme.id,
        versionNo: versionOf(yearPlan),
      }),
      ...savedWeek,
    });
  const themeDocOf = () => classThemePlans.find((t) => t.classId === classId && t.themeId === week?.theme.id) || null;

  useEffect(() => {
    if (dirty || !week) return;
    const blank = emptyWeekPlan({
      classId,
      yearPlanId: yearPlan.id,
      weekStart,
      weekNo: week.no,
      themeId: week.theme.id,
      versionNo: versionOf(yearPlan),
    });
    // Ghép kế hoạch tuần + giáo án ngày để bảng hoạt động và từng ngày cùng nối MT (EDU-16)
    const doc = split
      ? {
          // Bản BE thiếu trường (tài liệu soạn ngoài màn này) vẫn đủ khung từ bản trống
          ...blank,
          ...savedWeek,
          // Trang ngày: bản tuần đã sửa theo hồ sơ chủ đề thay cho bản theo kỳ (EDU-79)
          ...(days && savedDay?.week ? only(savedDay.week, WEEK_FIELDS) : {}),
          ...(savedDay
            ? {
                days: savedDay.days?.length ? savedDay.days : blank.days,
                dayGoals: savedDay.dayGoals,
                dossierCards: savedDay.week?.cards || [],
              }
            : {}),
        }
      : { ...blank, ...saved };
    // Bản soạn theo bố cục cũ hiện đúng ở mẫu mới, không mất chữ (FR-007, FR-013)
    const normalized = normalizeWeek(doc);
    normalized.days = (normalized.days || []).map(normalizeDay);
    // FR-011, FR-025: ô a) còn trống được điền câu MT một lần (người soạn)
    if (days && (saved?.permissions?.canEdit ?? canComposeClassDocs)) {
      const themeDoc = themeDocOf();
      const gs = themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), week.theme.id, themeDoc?.customTicks).flatMap(
        (b) => b.goals,
      );
      const cs = cardsOf(
        themeDoc,
        { cards: normalized.dossierCards },
        gs.map((g) => g.id),
      );
      normalized.days.forEach((d, i) => {
        const fw = dayDraftFromWeek(normalized, i, gs, cs);
        if (prefillDayAims(d, fw) && !d.basis) markDayBasis(d, fw);
      });
    }
    setDraft(normalized);
    saver.markClean(normalized);
    // dirty: lưu xong phải nạp lại bản đã lưu để mang số phiên bản mới, nếu không lần lưu kế tiếp bị từ chối (409)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    saved?.id,
    saved?.version,
    saved?.dossierVersion,
    saved?.status,
    saved?.history?.length,
    savedWeek?.version,
    week?.start,
    classId,
    dirty,
  ]);

  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan || !week) return <StatusPage kind="404" title="Không tìm thấy tuần học này trong kế hoạch năm của lớp" />;
  if (!draft) return <LoadingState />;

  const status = saved?.status || EDU_STATUS.DRAFT;
  const editable = contentEditable;
  // Quyền sửa do BE quyết định (bản chưa ban hành sửa được cả tuần đã tới sau khi mở hạn); FE không tự khóa theo ngày
  const sharedEditable = editable;
  const dayEditable = () => editable;
  // Chép giáo án tuần cũ sang phiên bản mới (BE:EDU-26), lưu ngay thành Nháp để sửa ô đỏ
  const copyOld = async () => {
    setCopying(true);
    const doc = await saveClassDoc('week', version.copy());
    setCopying(false);
    if (doc) toast('Đã chép kế hoạch tuần cũ. Sửa các ô đỏ trước khi gửi duyệt hồ sơ chủ đề.');
  };
  const fromTemplate = () => setDirty(true);
  const flagEdit = (fn) => update((d) => fn(d));
  const containerKey = saved?.containerKey || savedWeek?.containerKey;
  const container =
    [...semesterPackages, ...themeDossiers].find((d) => d.id === (days ? `ds_${classId}_${week.theme.id}` : containerKey)) || null;
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id);
  const branchName = branch?.names?.[weekStart] || '';
  const themeDoc = classThemePlans.find((t) => t.classId === classId && t.themeId === week.theme.id) || null;
  const pageTitle = dayPage
    ? `Kế hoạch giáo dục ngày ${cls.name}`
    : days
      ? `Kế hoạch giáo dục ngày tuần ${week.no}`
      : `Kế hoạch tuần ${week.no}`;
  const crumbs = dayPage
    ? [{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục ngày', to: `/education/day-plans/${classId}` }]
    : [{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục chủ đề' }, { label: pageTitle }];
  const dayUrl = (ws) => `/education/day-plans/${classId}?week=${ws}`;
  // Spec 004: hồ sơ chủ đề = giáo án ngày; kế hoạch tuần thuộc gói học kỳ
  const dossier = themeDossiers.find((d) => d.id === `ds_${classId}_${week.theme.id}`) || null;
  // EDU-79 (FR-015): tab Kế hoạch tuần ở trang ngày sửa được khi gói học kỳ chứa chủ đề đã ban hành, trước ngày bắt đầu chủ đề;
  // quyền sửa và khóa vẫn do BE quyết định
  const firstWeek = weeks.find((w) => w.theme.id === week.theme.id);
  weekEditableRef.editable =
    dayPage && editable && !!dossier && dossier.blockedReason !== 'SEMESTER_NOT_RELEASED' && todayIso() < firstWeek.start;
  const weekApproved = savedWeek?.status === EDU_STATUS.APPROVED;
  const dossierAct = async (action, note, _saved, extra) => {
    const out = await actOnClassDoc('dossier', dossier.id, { action, note, ...extra }, user, {
      version: dossier.version,
      // BE 7390: data.details = [{ date, section }] (axiosClient đặt data vào err.details)
      onError: (err) => {
        setEmptyErr((err.details?.details || []).filter((x) => x?.section && x?.date));
        setGoalErr((err.details?.details || []).filter((x) => x?.goalNo != null));
      },
    });
    if (out) {
      setEmptyErr([]);
      setGoalErr([]);
    }
    return out;
  };
  // Lỗi mục trống tự mất khi mục đó đã có nội dung
  const emptyNow = emptyErr.filter((e) => !sectionHasContent(draft.days.find((d) => d.date === e.date)?.sections?.[e.section]));
  const sectionLabel = (key) => DAY_SECTIONS.find((s) => s.key === key)?.label.replace(/^\d+\.\s*/, '') || key;
  // Hàng lọc chung các trang tài liệu lớp: Nhóm tuổi · Lớp · Chủ đề (· Tuần ở trang ngày), cùng một hàng bên trái (Tiền 12/11/2026)
  const themeOptions = themesWithWeeks(yearPlan).map((t) => ({ value: String(t.id), label: t.name }));
  const themeWeeks = weeks.filter((w) => w.theme.id === week.theme.id);
  const pickTheme = (id) => {
    const first = weeks.find((w) => String(w.theme.id) === id);
    if (!first) return;
    guard.leave(dayPage ? dayUrl(first.start) : `/education/class/${classId}/themes/${first.theme.id}`);
  };
  const dayFilter = (footer = null) => (
    <ClassFilterBar
      classes={classes}
      classId={classId}
      canPick={ctx.canPickClass}
      onPick={(id) => guard.leave(dayPage ? `/education/day-plans/${id}` : `/education/theme-plans/${id}`)}
      footer={footer}
    >
      <FilterSelect label="Chủ đề" value={String(week.theme.id)} options={themeOptions} onChange={pickTheme} />
      {dayPage && (
        <FilterSelect
          label="Tuần"
          value={weekStart}
          options={themeWeeks.map((w, i) => ({
            value: w.start,
            label: `Tuần ${i + 1} (${ddmm(w.start)})${branch?.names?.[w.start] ? `: ${branch.names[w.start]}` : ''}`,
          }))}
          onChange={(v) => guard.leave(dayUrl(v))}
        />
      )}
    </ClassFilterBar>
  );
  const dayPicker = dayFilter();
  // Mở thẳng đường dẫn khi chưa tới bước này: không hiện biểu mẫu, chỉ ra bước còn thiếu
  const lock =
    !saved &&
    createBlocker(
      'week',
      { classId, yearPlanId: yearPlan.id, themeId: week.theme.id, weekStart: week.start },
      { branchPlans, classThemePlans, yearPlan },
    );
  if (lock) {
    return (
      <div className="page ga-page">
        <div className="ga-sticky-head">
          <PageHead crumbs={crumbs} title={pageTitle} />
          {dayPicker}
        </div>
        <EmptyCard
          title={dayPage ? 'Chưa có kế hoạch giáo dục ngày của tuần này' : 'Chưa có kế hoạch tuần này'}
          desc={lock.need === 'branch' ? lock.message : undefined}
          action={
            lock.need === 'branch' && (
              <Link className="btn btn--outline-primary btn--sm" to={`/education/branches/${classId}`}>
                Đặt tên nhánh
              </Link>
            )
          }
        />
      </div>
    );
  }
  const update = (fn) => {
    setDraft((d) => fn(structuredClone(d)));
    setDirty(true);
  };
  // Gợi ý hoạt động = thẻ của kế hoạch chủ đề (+ thẻ bổ sung theo hồ sơ chủ đề); MT của từng ngày giải theo thẻ (EDU-78)
  const blocks = themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), week.theme.id, themeDoc?.customTicks);
  const goals = blocks.flatMap((b) => b.goals);
  const dossierWeek = { cards: draft.dossierCards || [] };
  const activities = themeActivities(blocks, themeDoc, dossierWeek);
  const cards = cardsOf(
    themeDoc,
    dossierWeek,
    goals.map((g) => g.id),
  );
  // FR-022: dòng tổng (tuần này + cả chủ đề); tuần khác: bản sửa theo hồ sơ (người soạn) hoặc bản hiệu lực
  const docOfWeek = (w) => {
    if (w.start === weekStart) return draft;
    const wp = weekPlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.weekStart === w.start) || null;
    const dp = dayPlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.weekStart === w.start) || null;
    return dp?.week && (canComposeClassDocs || dp.effectiveWeek === 'dossier') ? { ...wp, ...dp.week } : wp;
  };
  const summary = {
    week: coverageOf(goals, cards, [{ start: week.start, offDays: week.offDays, doc: draft }]),
    theme: coverageOf(
      goals,
      cards,
      weeks.filter((w) => w.theme.id === week.theme.id).map((w) => ({ start: w.start, offDays: w.offDays, doc: docOfWeek(w) })),
    ),
    onOpenCoverage: () => guard.leave(`/education/class/${classId}/themes/${week.theme.id}?tab=coverage`),
  };
  // FR-014: "Tạo thẻ từ hoạt động này" — kế hoạch chủ đề còn sửa được thì thêm thẻ vào đó (lưu chủ đề trước); đang sửa tuần
  // theo hồ sơ chủ đề thì thẻ lưu kèm bản tuần của hồ sơ, nhãn "bổ sung theo hồ sơ chủ đề"
  const dossierMode = dayPage && weekEditableRef.editable;
  const placeCard = (r, day, card) =>
    update((d) => {
      const key = cellKey(r.key, day);
      if (dossierMode) d.dossierCards = [...(d.dossierCards || []), card];
      d.picks = { ...(d.picks || {}), [key]: [{ id: card.id, cardId: card.id, goalIds: card.goalIds, text: cardText(card) }] };
      d.grid[r.key] ||= rowCell(d, r);
      return d;
    });
  const createCard = async (card) => {
    const { r, day } = cardFor;
    setCardFor(null);
    if (dossierMode) return placeCard(r, day, card);
    if (!themeDoc?.permissions?.canEdit) return toast('Kế hoạch chủ đề đã khóa, chưa thêm được hoạt động', 'warn');
    const out = await saveClassDoc('theme', {
      ...themeDoc,
      activities: [
        ...normalizeTheme(
          themeDoc,
          goals.map((g) => g.id),
        ),
        card,
      ],
    });
    if (out) placeCard(r, day, card);
  };
  // FR-017: ô khác bản theo kỳ (người duyệt và người soạn đều thấy); R5: bản theo kỳ đã đổi sau khi bắt đầu sửa
  const dayWeekNow = dayPage && savedDay?.week ? savedDay.week : null;
  const changedCells = dayPage && (dayWeekNow || weekEditableRef.editable) ? new Set(weekDiff(semesterView(), draft)) : null;
  const baseChanged = !!dayWeekNow?.base && JSON.stringify(dayWeekNow.base) !== JSON.stringify(weekBaseOf(savedWeek));
  const prevWeekDoc = weeks[idx - 1]
    ? weekPlans.find((w) => w.classId === classId && w.yearPlanId === yearPlan.id && w.weekStart === weeks[idx - 1].start) || null
    : null;
  const day = tab === 'week' ? -1 : Number(tab);
  // Tab Kế hoạch tuần: bản cũ chưa tách giáo án ngày, hoặc trang Kế hoạch giáo dục ngày (chỉ xem, làm căn cứ soạn ngày)
  const showWeekTab = !split || dayPage;
  const branchNo = branchNumber(yearPlan, weekStart, branch);
  const exportArgs = { doc: draft, week, cls, branchNo, branchName, leaderName: leaderNameOf(staff, cls.ageGroupId, yearPlan?.schoolYear) };

  // Mục của nút "Thao tác" ở trang ngày (Dạy học đứng trước Xuất file — Tiền 14/11/2026)
  const pageTools = dayPage
    ? [
        // Dạy học / trình chiếu chỉ theo từng ngày (Tiền 12/11/2026), dùng học liệu của kế hoạch giáo dục ngày (BE:EDU-81)
        ...(day >= 0
          ? [
              {
                label: savedDay ? 'Dạy học ngày này' : 'Dạy học ngày này (lưu trước)',
                icon: ChalkboardTeacher,
                disabled: !savedDay,
                onClick: () =>
                  guard.leave(
                    `/education/class/${classId}/themes/${week.theme.id}/teach?week=${encodeURIComponent(weekStart)}&date=${encodeURIComponent(draft.days[day].date)}`,
                  ),
              },
            ]
          : []),
        // EDU-90: xuất file theo vai trò người tạo, BE trả cờ
        ...(saved?.permissions?.canExport !== false
          ? [{ label: 'Xuất file', icon: FileDown, onClick: () => setPreview(dayPlansFile(exportArgs)) }]
          : []),
        ...(dossier?.canRevise ? [{ label: 'Tạo phiên bản điều chỉnh', icon: Copy, onClick: () => setConfirmRevise(true) }] : []),
      ]
    : [];

  const moveTab = (event) => {
    const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')];
    const current = tabs.indexOf(event.target);
    if (current < 0) return;
    const nextTab = {
      ArrowRight: (current + 1) % tabs.length,
      ArrowLeft: (current + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (nextTab === undefined) return;
    event.preventDefault();
    setTab(!showWeekTab ? String(nextTab) : nextTab === 0 ? 'week' : String(nextTab - 1));
    tabs[nextTab].focus({ preventScroll: true });
  };

  // Hàng tab của chủ đề: Kế hoạch chủ đề rồi các chủ đề nhánh (qua guard để hỏi khi còn thay đổi chưa lưu)
  const themeWeekTabs = (
    <ThemeBranchTabs
      yearPlan={yearPlan}
      branchDoc={branch}
      themeId={week.theme.id}
      classId={classId}
      current={weekStart}
      onGo={guard.leave}
    />
  );
  // Tên chủ đề nhánh + tab: trang ngày đặt chung thẻ với hàng lọc, Kế hoạch tuần là tab đầu rồi tới Thứ 2–6 (Tiền 12/11/2026)
  const weekHead = (
    <>
      {/* Tên chủ đề nhánh nằm chung thẻ với tab tuần / ngày (Tiền 04/11) */}
      <div className="card__body">
        <div>
          <div className="ga-week-hero__label">
            Chủ đề nhánh {branchNo} · Tuần {week.no} của năm học
          </div>
          <div className={`ga-week-hero__name ${branchName ? '' : 'muted'}`}>{branchName || 'Chưa đặt tên chủ đề nhánh'}</div>
          <div className="ga-week-hero__meta">
            Chủ đề: {week.theme.name} · {fmtDate(week.start)} → {fmtDate(week.end)}
          </div>
        </div>
      </div>
      {(days || !split) && (
        <div className="tabs ga-class-tabs" role="tablist" aria-label="Kế hoạch tuần và ngày" onKeyDown={moveTab}>
          {showWeekTab && (
            <button
              type="button"
              role="tab"
              id={`${tabId}-week`}
              aria-controls={`${tabId}-panel-week`}
              tabIndex={tab === 'week' ? 0 : -1}
              aria-selected={tab === 'week'}
              className={`tab ${tab === 'week' ? 'tab--active' : ''}`}
              onClick={() => setTab('week')}
            >
              Kế hoạch tuần
            </button>
          )}
          {draft.days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              role="tab"
              id={`${tabId}-${i}`}
              aria-controls={`${tabId}-panel-${i}`}
              tabIndex={tab === String(i) ? 0 : -1}
              aria-selected={tab === String(i)}
              className={`tab ${tab === String(i) ? 'tab--active' : ''}`}
              onClick={() => setTab(String(i))}
            >
              {WEEKDAY_LABELS[i]}
              <span className="ga-class-tab__sep"> · </span>
              <span className="ga-class-tab__date">
                {ddmm(d.date)}
                {week?.offDays?.[i] ? ' · Nghỉ' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="page ga-page ga-class-editor">
      <div className="ga-sticky-head">
        <PageHead crumbs={crumbs} title={pageTitle} />
        {dayPage && dayFilter(weekHead)}
        {/* Trang Kế hoạch tuần (Kế hoạch giáo dục chủ đề): thẻ tên chủ đề nhánh ở đầu trang như trang ngày, tab sang các tuần
            khác của cùng chủ đề (Tiền 12/11/2026) */}
        {!dayPage &&
          dayFilter(
            <>
              {weekHead}
              {split && !days && themeWeekTabs}
            </>,
          )}
        {/* Thanh thao tác như màn Kế hoạch năm học: nút cỡ nhỏ viền xanh, nhóm lưu/xuất bên phải (Tiền 05/11) */}
        <div className="ga-year-toolbar" role="group" aria-label="Thao tác kế hoạch tuần">
          <div className="ga-year-toolbar__group">
            {/* Tên ngắn hiện khi hàng nút đang dính, thay cho phần đầu trang đã cuộn khuất (Tiền 12/11/2026) */}
            <span className="ga-year-toolbar__title">
              Tuần {week.no} · {week.theme.name}
            </span>
            {/* Trạng thái, hạn chỉ ở trang danh sách (thẻ học kỳ / thẻ chủ đề), không lặp ở trang trong (Tiền 14/11/2026) */}
            <FoldAllButton />
            {/* Một nút "Thao tác" mở danh sách: Lấy / gợi ý → Dạy học → Xuất file → Tạo phiên bản (Tiền 14/11/2026); ngày đang
                sửa thì DayTab đặt nút vào chỗ này kèm các mục của ngày */}
            {dayPage && <span ref={setToolsEl} className="row row--middle gap-2" />}
            {dayPage && !(editable && day >= 0) && <ActionsMenu items={pageTools} />}
          </div>
          <div className="ga-year-toolbar__group ga-year-toolbar__group--end">
            {editable && (
              <>
                <p className="muted text-sm ga-year-save-status" aria-live="polite">
                  {saver.label}
                </p>
                <VersionHistory
                  drafts={saver.drafts}
                  saved={saver.cleanDoc()}
                  current={draft}
                  unsaved={saver.unsaved}
                  linesOf={docLines}
                  onUse={(entry) => (entry ? saver.restoreDraft(entry) : saver.restoreSaved())}
                />
                {/* Trang luôn ở chế độ sửa: Hủy về Kế hoạch giáo dục chủ đề của lớp, còn thay đổi chưa lưu thì hỏi (Tiền 13/11/2026) */}
                {!dayPage && (
                  <Button
                    variant="outline-primary"
                    size="sm"
                    disabled={saver.saving}
                    onClick={() => guard.leave(`/education/theme-plans/${classId}`)}
                  >
                    <X size={16} aria-hidden /> Hủy
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  onClick={saver.save}
                  disabled={saver.saving || (!saver.unsaved && !saver.error)}
                  title="Lưu (Ctrl+S)"
                >
                  <Save size={16} aria-hidden /> Lưu
                </Button>
              </>
            )}
            {preview && <DocPreviewModal file={preview} onClose={() => setPreview(null)} />}
          </div>
        </div>
      </div>
      {canComposeClassDocs && (
        <SupersededNote doc={saved || (ctx.superseded ? { superseded: true, yearPlanVersion: versionOf(yearPlan) } : null)} />
      )}
      {canComposeClassDocs && !saved && version.finished && <FinishedThemeNote />}
      {!saved && !version.finished && version.prevDoc && !dirty && (
        <VersionCopyOffer
          plan={yearPlan}
          previous={ctx.previousPlan}
          prevDoc={version.prevDoc}
          canCreate={sharedEditable}
          busy={copying}
          onTemplate={fromTemplate}
          onCopy={copyOld}
        />
      )}
      <VersionFlagsPanel
        flags={version.flags}
        doc={draft}
        editable={editable}
        onCheck={(f) => flagEdit((d) => checkFlag(d, f))}
        onDrop={(f) => flagEdit((d) => dropReference('week', d, f))}
      />
      <RejectedNotice
        status={(dayPage ? dossier : container || themeDoc)?.status}
        history={(dayPage ? dossier : container || themeDoc)?.history}
      />
      {/* Gói học kỳ chưa ban hành: không hiện dòng nhắc, bấm Gửi duyệt ở trang danh sách mới cảnh báo (Tiền 14/11/2026) */}
      {dayPage && dossier && dossier.blockedReason !== 'SEMESTER_NOT_RELEASED' && (
        <BlockedNotice doc={dossier} author={canComposeClassDocs} />
      )}
      {/* Mỗi phần lớn là một thẻ thu gọn được, như các trang khác của kế hoạch giáo dục (Tiền 11/11/2026) */}
      <div className="stack mt-16" role="tabpanel" id={`${tabId}-panel-${tab}`} aria-labelledby={`${tabId}-${tab}`}>
        {days && goalErr.length > 0 && (
          <p className="text-danger text-sm text-right" role="alert">
            MT chưa được dạy ngày nào: {goalErr.map((g) => `MT${g.goalNo}`).join(', ')}
          </p>
        )}
        {days && emptyNow.length > 0 && (
          <p className="field__error" role="alert">
            Còn {emptyNow.length} mục chưa có nội dung:{' '}
            {emptyNow
              .map((e) => {
                const i = draft.days.findIndex((d) => d.date === e.date);
                return `${WEEKDAY_LABELS[i] || ''} ${ddmm(e.date)}: ${sectionLabel(e.section)}`;
              })
              .join('; ')}
            .
          </p>
        )}
        {day < 0 && dayPage ? (
          // Kế hoạch tuần làm căn cứ soạn giáo án ngày, chỉ xem (spec 004 FR-010); chưa duyệt vẫn soạn được ngày (Q1)
          <>
            {/* Trạng thái duyệt của hồ sơ đã ở thanh thao tác; tab tuần chỉ báo bằng chữ khi kế hoạch tuần chưa duyệt / chưa soạn */}
            {!savedWeek && <p className="muted text-sm">Chưa soạn kế hoạch tuần.</p>}
            {/* Đã báo gói học kỳ chưa ban hành (hồ sơ bị chặn vì gói học kỳ chưa ban hành) thì không nhắc lại kế hoạch tuần (Tiền 12/11/2026) */}
            {canComposeClassDocs &&
              savedWeek &&
              !weekApproved &&
              !(dossier?.status === EDU_STATUS.DRAFT && dossier?.blockedReason === 'SEMESTER_NOT_RELEASED') && (
                <Notice>Kế hoạch tuần chưa được duyệt.</Notice>
              )}
            {changedCells?.size > 0 && <p className="text-sm text-warning">Đã sửa theo chủ đề</p>}
            {baseChanged && <p className="text-sm text-warning">Bản theo kỳ đã đổi</p>}
            {(draft.dossierCards || []).length > 0 && (
              <p className="text-sm">Bổ sung theo hồ sơ chủ đề: {draft.dossierCards.map((c) => cardText(c)).join('; ')}</p>
            )}
            {savedWeek && (
              <WeekTab
                draft={draft}
                week={week}
                editable={weekEditableRef.editable}
                update={weekEditableRef.editable ? update : () => {}}
                activities={activities}
                cards={cards}
                goals={goals}
                summary={summary}
                changedCells={changedCells}
                onCreateCard={weekEditableRef.editable ? (r, d, text) => setCardFor({ r, day: d, text }) : null}
              />
            )}
          </>
        ) : day < 0 ? (
          <WeekTab
            draft={draft}
            week={week}
            editable={sharedEditable}
            dayEditable={dayEditable}
            update={update}
            activities={activities}
            cards={cards}
            prevWeek={prevWeekDoc}
            summary={summary}
            goals={goals}
            onCreateCard={sharedEditable ? (r, d, text) => setCardFor({ r, day: d, text }) : null}
            flagOf={(id) => version.unresolved.find((f) => f.goalId === String(id)) || null}
          />
        ) : (
          <DayTab
            draft={draft}
            index={day}
            editable={dayEditable(day)}
            update={update}
            goals={goals}
            cards={cards}
            reuse={lessonReuseFor(split ? dayPlans : weekPlans, draft, day)}
            emptySections={emptyNow.filter((e) => e.date === draft.days[day].date).map((e) => e.section)}
            toolsTarget={toolsEl}
            extraTools={pageTools}
            flagOf={(id) => version.unresolved.find((f) => f.goalId === String(id)) || null}
            offLabel={week?.offDays?.[day] || null}
            assessTo={
              (split ? savedDay?.status : status) === EDU_STATUS.APPROVED
                ? `/assessment/daily/skills?classId=${classId}&date=${draft.days[day].date}`
                : null
            }
          />
        )}
      </div>
      {/* BE:EDU-81 — học liệu chỉ ở kế hoạch giáo dục ngày, theo từng mục của ngày đang mở */}
      {split && day >= 0 && (
        <DayResources
          user={user}
          docKey={savedDay?.id || null}
          date={draft.days[day].date}
          editable={dayEditable(day)}
          ageGroupId={cls.ageGroupId}
          // BE:EDU-87 — nhãn học liệu = chủ đề của tuần + MT của các hoạt động đã xếp vào mục của ngày
          tagsOf={(key) => ({
            themeId: week.theme.id,
            themeName: week.theme.name,
            goalIds: (dayDraftFromWeek(draft, day, goals, cards)[key]?.goals || []).map((g) => g.id),
          })}
        />
      )}
      {cardFor && (
        <ActivityCardEditor
          goals={goals}
          contentsOf={(g) => themeRowOf(themeDoc, g).contents}
          defaultName={cardFor.text}
          defaultSlot={cardFor.r.key}
          origin={dossierMode ? 'dossier' : undefined}
          onSave={createCard}
          onClose={() => setCardFor(null)}
        />
      )}
      <ConfirmationModal
        open={confirmRevise}
        title={`Tạo phiên bản điều chỉnh hồ sơ chủ đề "${week.theme.name}"?`}
        message="Bản đã ban hành vẫn hiệu lực tới khi phiên bản mới được duyệt."
        confirmLabel="Tạo phiên bản"
        onConfirm={async () => {
          setConfirmRevise(false);
          await dossierAct('revise');
        }}
        onClose={() => setConfirmRevise(false)}
      />
      <LeaveConfirmModal
        {...guard.modal}
        onDiscard={() => {
          saver.discardBackup();
          guard.modal.onDiscard();
        }}
      />
    </div>
  );
}
