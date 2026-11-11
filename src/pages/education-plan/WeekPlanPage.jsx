import { useEffect, useId, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { ClassFilterBar, docReview } from '@/components/education-plan/planUi';
import { ReviewActions } from '@/components/education-plan/reviewUi';
import { BlockedNotice, DeadlineBadge } from '@/components/education-plan/DeadlineWidgets';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Copy, FileDown, Save } from '@/components/ui/icons';
import { Card, EduStatusBadge, Notice, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import { VersionHistory } from '@/components/education-plan/VersionHistory';
import { docLines } from '@/models/education-plan/planHistory.mjs';
import { useClassPlanContext } from '@/components/education-plan/planUi';
import { RejectedNotice } from '@/components/education-plan/reviewUi';
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
  createBlocker,
  dayGoalsOf,
  ddmm,
  emptyWeekPlan,
  isEditableStatus,
  lessonReuseFor,
  normalizeDay,
  normalizeWeek,
  placedInOtherWeeks,
  sectionHasContent,
  themeCoverage,
  todayIso,
  themeActivities,
  themeGoalBlocks,
  yearWeeks,
} from '@/models/education-plan/classPlan';
import { dayPlansFile, leaderNameOf, weekFile } from '@/utils/education-plan/classPlanDoc';
import { DayTab, WeekTab } from '@/components/education-plan/WeekPlanBody';
import { FinishedThemeNote, SupersededNote, VersionCopyOffer, VersionFlagsPanel } from '@/components/education-plan/VersionWidgets';
import { useDocVersion } from '@/hooks/education-plan/useDocVersion';
import { checkFlag, dropReference, versionOf } from '@/models/education-plan/planVersions.mjs';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';
import { dayKeyOf } from '@/models/education-plan/deadline.mjs';

const DAY_FIELDS = ['days', 'dayGoals'];
const without = (doc, keys) => Object.fromEntries(Object.entries(doc).filter(([k]) => !keys.includes(k)));

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
    eduConfig,
    toast,
    staff,
  } = useEducationPlan();
  const [confirmRevise, setConfirmRevise] = useState(false);
  const [weekOpen, setWeekOpen] = useState(true);
  const [preview, setPreview] = useState(null);
  // Mục còn trống BE trả khi gửi hồ sơ chủ đề (FR-007a): [{ date, section }], hiện chữ đỏ tới khi sửa xong
  const [emptyErr, setEmptyErr] = useState([]);
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
      const dayDoc = {
        id: savedDay?.id || dayKeyOf(doc.id),
        classId: doc.classId,
        yearPlanId: doc.yearPlanId,
        themeId: doc.themeId,
        weekStart: doc.weekStart,
        days: doc.days,
        dayGoals: dayGoalsOf(doc),
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
          ...(savedDay ? { days: savedDay.days?.length ? savedDay.days : blank.days, dayGoals: savedDay.dayGoals } : {}),
        }
      : { ...blank, ...saved };
    // Bản soạn theo bố cục cũ hiện đúng ở mẫu mới, không mất chữ (FR-007, FR-013)
    const normalized = normalizeWeek(doc);
    normalized.days = (normalized.days || []).map(normalizeDay);
    setDraft(normalized);
    saver.markClean(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.version, saved?.dossierVersion, saved?.status, saved?.history?.length, savedWeek?.version, week?.start, classId]);

  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan || !week) return <StatusPage kind="404" title="Không tìm thấy tuần học này trong kế hoạch năm của lớp" />;
  if (!draft) return <LoadingState />;

  const status = saved?.status || EDU_STATUS.DRAFT;
  const editable = contentEditable;
  const today = todayIso();
  const sharedEditable = editable && weekStart > today;
  const dayEditable = (index) => editable && draft?.days?.[index]?.date > today;
  // Chép giáo án tuần cũ sang phiên bản mới (BE:EDU-26), lưu ngay thành Nháp để sửa ô đỏ
  const copyOld = async () => {
    setCopying(true);
    const doc = await saveClassDoc('week', version.copy());
    setCopying(false);
    if (doc) toast('Đã chép giáo án tuần cũ. Sửa các ô đỏ trước khi gửi duyệt hồ sơ chủ đề.');
  };
  const fromTemplate = () => setDirty(true);
  const flagEdit = (fn) => update((d) => fn(d));
  const containerKey = saved?.containerKey || savedWeek?.containerKey;
  const container =
    [...semesterPackages, ...themeDossiers].find((d) => d.id === (days ? `ds_${classId}_${week.theme.id}` : containerKey)) || null;
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id);
  const branchName = branch?.names?.[weekStart] || '';
  const themeDoc = classThemePlans.find((t) => t.classId === classId && t.themeId === week.theme.id) || null;
  const pageTitle = dayPage ? `Kế hoạch giáo dục ngày ${cls.name}` : days ? `Giáo án ngày tuần ${week.no}` : `Kế hoạch tuần ${week.no}`;
  const crumbs = dayPage
    ? [{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục ngày' }]
    : [{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục chủ đề' }, { label: pageTitle }];
  const dayUrl = (ws) => `/education/day-plans/${classId}?week=${ws}`;
  // Spec 004: hồ sơ chủ đề = giáo án ngày; kế hoạch tuần thuộc gói học kỳ
  const dossier = themeDossiers.find((d) => d.id === `ds_${classId}_${week.theme.id}`) || null;
  const weekPackage = semesterPackages.find((d) => d.id === savedWeek?.containerKey) || null;
  const weekApproved = savedWeek?.status === EDU_STATUS.APPROVED;
  const dossierAct = async (action, note, _saved, extra) => {
    const out = await actOnClassDoc('dossier', dossier.id, { action, note, ...extra }, user, {
      version: dossier.version,
      // BE 7390: data.details = [{ date, section }] (axiosClient đặt data vào err.details)
      onError: (err) => setEmptyErr((err.details?.details || []).filter((x) => x?.section && x?.date)),
    });
    if (out) setEmptyErr([]);
    return out;
  };
  // Lỗi mục trống tự mất khi mục đó đã có nội dung
  const emptyNow = emptyErr.filter((e) => !sectionHasContent(draft.days.find((d) => d.date === e.date)?.sections?.[e.section]));
  const sectionLabel = (key) => DAY_SECTIONS.find((s) => s.key === key)?.label.replace(/^\d+\.\s*/, '') || key;
  const dossierReview = dossier ? docReview('theme', dossier, ctx, user, eduConfig) : null;
  // Trang ngày: chọn lớp và tuần ngay đầu trang, kể cả khi tuần đó chưa soạn được
  const dayPicker = dayPage && (
    <ClassFilterBar
      classes={classes}
      classId={classId}
      canPick={ctx.canPickClass}
      onPick={(id) => guard.leave(`/education/day-plans/${id}`)}
    >
      <div className="field">
        <label className="field__label" htmlFor={`${tabId}-week`}>
          Tuần
        </label>
        <select id={`${tabId}-week`} className="select" value={weekStart} onChange={(e) => guard.leave(dayUrl(e.target.value))}>
          {weeks.map((w) => (
            <option key={w.start} value={w.start}>
              {w.theme.name} · Tuần {w.no} ({ddmm(w.start)})
            </option>
          ))}
        </select>
      </div>
    </ClassFilterBar>
  );
  // Mở thẳng đường dẫn khi chưa tới bước này: không hiện biểu mẫu, chỉ ra bước còn thiếu
  const lock =
    !saved && createBlocker('week', { classId, yearPlanId: yearPlan.id, themeId: week.theme.id }, { branchPlans, classThemePlans });
  if (lock) {
    return (
      <div className="page ga-page">
        <PageHead crumbs={crumbs} title={pageTitle} desc={`${cls.name} · ${fmtDate(week.start)} → ${fmtDate(week.end)}`} />
        {dayPicker}
        <Notice tone="warn">Chưa thể bắt đầu: {lock.message}</Notice>
      </div>
    );
  }
  const update = (fn) => {
    setDraft((d) => fn(structuredClone(d)));
    setDirty(true);
  };
  // Gợi ý hoạt động lấy từ cột Hoạt động giáo dục của kế hoạch chủ đề; MT của từng ngày lưu kèm để đánh giá trẻ sau này
  const blocks = themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), week.theme.id);
  const goals = blocks.flatMap((b) => b.goals);
  const activities = themeActivities(blocks, (g) => themeRowOf(themeDoc, g));
  const themeWeekDocs = weekPlans.filter((w) => w.classId === classId && w.yearPlanId === yearPlan.id && w.themeId === week.theme.id);
  const placedElsewhere = placedInOtherWeeks(themeWeekDocs, weekStart);
  // Tiến độ cả chủ đề (bản đang soạn thay cho bản đã lưu của tuần này)
  const coverage = themeCoverage(goals, activities, [...themeWeekDocs.filter((w) => w.weekStart !== weekStart), draft]);
  const prevWeekDoc = weeks[idx - 1]
    ? weekPlans.find((w) => w.classId === classId && w.yearPlanId === yearPlan.id && w.weekStart === weeks[idx - 1].start) || null
    : null;
  const day = tab === 'week' ? -1 : Number(tab);
  const branchNo = branchNumber(yearPlan, weekStart, branch);
  const exportArgs = { doc: draft, week, cls, branchNo, branchName, leaderName: leaderNameOf(staff, cls.ageGroupId, yearPlan?.schoolYear) };

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
    setTab(split ? String(nextTab) : nextTab === 0 ? 'week' : String(nextTab - 1));
    tabs[nextTab].focus({ preventScroll: true });
  };

  return (
    <div className="page ga-page ga-class-editor">
      <div className="ga-sticky-head">
        <PageHead
          crumbs={crumbs}
          title={pageTitle}
          desc={dayPage ? undefined : `${cls.name} · ${fmtDate(week.start)} → ${fmtDate(week.end)}`}
        />
        {/* Thanh thao tác như màn Kế hoạch năm học: nút cỡ nhỏ viền xanh, nhóm lưu/xuất bên phải (Tiền 05/11) */}
        <div className="ga-year-toolbar" role="group" aria-label="Thao tác giáo án tuần">
          <div className="ga-year-toolbar__group">
            {/* Trạng thái theo kế hoạch chủ đề (giáo án tuần gửi / duyệt cùng kế hoạch chủ đề), đặt ở header như mục tiêu năm học */}
            <EduStatusBadge status={(container || themeDoc)?.status || EDU_STATUS.DRAFT} doc={container || themeDoc} />
            <button
              type="button"
              className="btn btn--sm btn--outline-primary"
              disabled={!saved || !themeDoc}
              title={!themeDoc ? 'Lưu kế hoạch chủ đề trước' : !saved ? 'Lưu giáo án trước để dạy học' : undefined}
              onClick={() =>
                guard.leave(
                  `/education/class/${classId}/themes/${week.theme.id}/teach?week=${encodeURIComponent(weekStart)}${day >= 0 ? `&date=${encodeURIComponent(draft.days[day].date)}` : ''}`,
                )
              }
            >
              Dạy học{day >= 0 ? ' ngày này' : ' tuần này'}
            </button>
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
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  onClick={saver.save}
                  disabled={saver.saving || (!saver.unsaved && !saver.error)}
                  title="Lưu (Ctrl+S)"
                >
                  <Save size={16} aria-hidden /> Lưu
                </button>
              </>
            )}
            {dayPage && dossier && (
              <>
                <ReviewActions
                  name={`hồ sơ chủ đề ${week.theme.name}`}
                  sendTo={dossierReview.sendTo}
                  sendLabel="Gửi duyệt hồ sơ chủ đề"
                  can={dossierReview.can}
                  showSend={canComposeClassDocs && dossier.status === EDU_STATUS.DRAFT}
                  sendDisabledReason={
                    dossier.blockedReason === 'SEMESTER_NOT_RELEASED'
                      ? 'Kế hoạch chủ đề và kế hoạch tuần của học kỳ chưa được duyệt'
                      : 'Chưa gửi được hồ sơ chủ đề này'
                  }
                  unsaved={saver.unsaved}
                  onSave={saver.save}
                  onAct={dossierAct}
                  variant="btn--outline-primary"
                />
                {dossier.canRevise && (
                  <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setConfirmRevise(true)}>
                    <Copy size={16} aria-hidden /> Tạo phiên bản điều chỉnh
                  </button>
                )}
              </>
            )}
            {/* In giáo án tuần ở mọi bước (đã duyệt thì in để dạy hằng ngày) */}
            <button
              type="button"
              className="btn btn--sm btn--outline-primary"
              onClick={() => setPreview(days ? dayPlansFile(exportArgs) : weekFile(exportArgs))}
            >
              <FileDown size={16} aria-hidden /> Xuất file
            </button>
            {preview && <DocPreviewModal file={preview} onClose={() => setPreview(null)} />}
          </div>
        </div>
      </div>
      {dayPicker}
      {dayPage && dossier && (
        <div className="row row--wrap gap-2 mb-16">
          <DeadlineBadge doc={dossier} />
        </div>
      )}
      <SupersededNote doc={saved || (ctx.superseded ? { superseded: true, yearPlanVersion: versionOf(yearPlan) } : null)} />
      {!saved && version.finished && <FinishedThemeNote />}
      {editable && (saved?.status === EDU_STATUS.APPROVED || themeDoc?.status === EDU_STATUS.APPROVED) && (
        <Notice tone="warn">Lưu thay đổi sẽ đưa hồ sơ chủ đề này về Nháp để gửi duyệt lại. Phần đã đến ngày dạy giữ nguyên.</Notice>
      )}
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
      {dayPage && dossier && <BlockedNotice doc={dossier} author={canComposeClassDocs} />}
      {dayPage && (
        // Kế hoạch tuần làm căn cứ soạn giáo án ngày (spec 004 FR-010); chưa duyệt vẫn soạn được ngày (Q1)
        <Card
          title={`Kế hoạch tuần ${week.no}`}
          className="mb-16"
          collapsed={!weekOpen}
          onToggle={() => setWeekOpen((v) => !v)}
          actions={
            <span className="row row--wrap gap-2">
              {savedWeek ? (
                <EduStatusBadge status={savedWeek.status} doc={weekPackage || savedWeek} />
              ) : (
                <span className="muted text-sm">Chưa soạn</span>
              )}
            </span>
          }
        >
          {!weekApproved && <Notice tone="warn">Kế hoạch tuần chưa được duyệt.</Notice>}
          {savedWeek ? (
            <WeekTab draft={draft} week={week} editable={false} update={() => {}} activities={activities} goals={goals} />
          ) : (
            <p className="muted">Chưa có kế hoạch tuần.</p>
          )}
        </Card>
      )}
      <Card bodyClass={null}>
        {/* Tên chủ đề nhánh nằm chung thẻ với tab tuần / ngày (Tiền 04/11) */}
        <div className="card__body">
          <div className="ga-week-hero__label">
            Chủ đề nhánh {branchNo} · Tuần {week.no} của năm học
          </div>
          <div className={`ga-week-hero__name ${branchName ? '' : 'muted'}`}>{branchName || 'Chưa đặt tên chủ đề nhánh'}</div>
          <div className="ga-week-hero__meta">
            Chủ đề: {week.theme.name} · {fmtDate(week.start)} → {fmtDate(week.end)}
          </div>
        </div>
        {(days || !split) && (
          <div className="tabs ga-class-tabs" role="tablist" aria-label="Kế hoạch tuần và ngày" onKeyDown={moveTab}>
            {!split && (
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
        <div className="card__body stack" role="tabpanel" id={`${tabId}-panel-${tab}`} aria-labelledby={`${tabId}-${tab}`}>
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
          {day < 0 ? (
            <WeekTab
              draft={draft}
              week={week}
              editable={sharedEditable}
              dayEditable={dayEditable}
              update={update}
              activities={activities}
              placedElsewhere={placedElsewhere}
              prevWeek={prevWeekDoc}
              coverage={coverage}
              goals={goals}
              flagOf={(id) => version.unresolved.find((f) => f.goalId === String(id)) || null}
            />
          ) : (
            <DayTab
              draft={draft}
              index={day}
              editable={dayEditable(day)}
              update={update}
              goals={goals}
              reuse={lessonReuseFor(split ? dayPlans : weekPlans, draft, day)}
              emptySections={emptyNow.filter((e) => e.date === draft.days[day].date).map((e) => e.section)}
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
      </Card>
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
