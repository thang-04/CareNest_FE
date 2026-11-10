import { useEffect, useId, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, FileDown, Save } from '@/components/ui/icons';
import { Card, EduStatusBadge, Notice, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import { VersionHistory } from '@/components/education-plan/VersionHistory';
import { docLines } from '@/models/education-plan/planHistory.mjs';
import { DocReviewButton, lockTarget, useClassPlanContext } from '@/components/education-plan/planUi';
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
  WEEKDAY_LABELS,
  branchNumber,
  createBlocker,
  dayGoalsOf,
  ddmm,
  emptyWeekPlan,
  isEditableStatus,
  lessonReuseFor,
  placedInOtherWeeks,
  themeCoverage,
  todayIso,
  themeActivities,
  themeGoalBlocks,
  yearWeeks,
} from '@/models/education-plan/classPlan';
import { leaderNameOf, weekFile } from '@/utils/education-plan/classPlanDoc';
import { DayTab, WeekTab } from '@/components/education-plan/WeekPlanBody';
import { FinishedThemeNote, SupersededNote, VersionCopyOffer, VersionFlagsPanel } from '@/components/education-plan/VersionWidgets';
import { useDocVersion } from '@/hooks/education-plan/useDocVersion';
import { checkFlag, dropReference, versionOf } from '@/models/education-plan/planVersions.mjs';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';
import { dayKeyOf } from '@/models/education-plan/deadline.mjs';

const DAY_FIELDS = ['days', 'dayGoals', 'adjustments'];
const without = (doc, keys) => Object.fromEntries(Object.entries(doc).filter(([k]) => !keys.includes(k)));

/**
 * Spec 003 (Q9): hai trang của một tuần — mode 'week' = Kế hoạch tuần (mục đích, chuẩn bị, bảng hoạt động Thứ 2–6),
 * mode 'days' = Giáo án ngày (5 kế hoạch ngày + điều chỉnh sau dạy). Mỗi phần theo trạng thái gói/hồ sơ chứa nó; gửi và
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

function WeekPlanInner({ mode }) {
  const tabId = useId();
  const { classId, weekStart } = useParams();
  const {
    user,
    weekPlans,
    dayPlans,
    branchPlans,
    classThemePlans,
    themeDossiers,
    semesterPackages,
    saveClassDoc,
    saveClassDocAdjustments,
    toast,
    staff,
  } = useEducationPlan();
  const [preview, setPreview] = useState(null);
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan, canComposeClassDocs } = ctx;
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
  // Nội dung sửa khi Nháp / Bị trả lại trên phiên bản hiện hành; ô điều chỉnh của ngày ghi được ở mọi trạng thái (BE:EDU-27)
  const contentEditable =
    !ctx.superseded &&
    (saved?.permissions
      ? saved.permissions.canEdit
      : saved
        ? canComposeClassDocs && isEditableStatus(saved.status)
        : ctx.canCreate('week'));
  const adjustEditable = !!saved && (saved.permissions ? saved.permissions.canEditAdjustments : canComposeClassDocs);
  const sameAdjust = (a, b) => JSON.stringify(a || {}) === JSON.stringify(b || {});

  // Lưu tay (nút Lưu, Ctrl+S); rời trang khi chưa lưu thì hỏi
  const saver = useManualSave({
    doc: draft,
    enabled: contentEditable || adjustEditable,
    save: async (doc) => {
      if (!split) {
        let out = contentEditable ? await saveClassDoc('week', { ...doc, dayGoals: dayGoalsOf(doc) }) : saved;
        if (out && !sameAdjust(doc.adjustments, out.adjustments)) out = await saveClassDocAdjustments(out.id, doc.adjustments || {}, out);
        return out;
      }
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
      let out = contentEditable ? await saveClassDoc('day', dayDoc) : savedDay;
      if (out && !sameAdjust(doc.adjustments, out.adjustments)) out = await saveClassDocAdjustments(out.id, doc.adjustments || {}, out);
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
    when: (contentEditable || adjustEditable) && saver.unsaved,
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
          ...(savedWeek || blank),
          ...(savedDay
            ? { days: savedDay.days?.length ? savedDay.days : blank.days, dayGoals: savedDay.dayGoals, adjustments: savedDay.adjustments }
            : {}),
        }
      : saved || blank;
    setDraft(doc);
    saver.markClean(doc);
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
  const base = `/education/class/${classId}`;
  // Gửi / duyệt cả kế hoạch chủ đề ở trang kế hoạch chủ đề (trang hồ sơ đã bỏ, Tiền 04/11)
  const containerKey = saved?.containerKey || savedWeek?.containerKey;
  const container =
    [...semesterPackages, ...themeDossiers].find((d) => d.id === (days ? `ds_${classId}_${week.theme.id}` : containerKey)) || null;
  const dossierTo =
    !days && container?.kind === 'semester' ? `${base}/semesters/${container.semesterNo}` : `${base}/themes/${week.theme.id}`;
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id);
  const branchName = branch?.names?.[weekStart] || '';
  const themeDoc = classThemePlans.find((t) => t.classId === classId && t.themeId === week.theme.id) || null;
  const pageTitle = days ? `Giáo án ngày tuần ${week.no}` : `Kế hoạch tuần ${week.no}`;
  const crumbs = [{ label: 'Kế hoạch giáo dục' }, { label: `Kế hoạch ${cls.name}`, to: base }, { label: pageTitle }];
  // Mở thẳng đường dẫn khi chưa tới bước này: không hiện biểu mẫu, chỉ ra bước còn thiếu
  const lock =
    !saved && createBlocker('week', { classId, yearPlanId: yearPlan.id, themeId: week.theme.id }, { branchPlans, classThemePlans });
  if (lock) {
    const target = lockTarget(lock, base, week.theme.id);
    return (
      <div className="page ga-page">
        <PageHead crumbs={crumbs} title={pageTitle} desc={`${cls.name} · ${fmtDate(week.start)} → ${fmtDate(week.end)}`} />
        <Notice tone="warn">
          Chưa thể bắt đầu: {lock.message} <Link to={target.to}>{target.label}</Link>
        </Notice>
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
  const prev = weeks[idx - 1];
  const next = weeks[idx + 1];
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
        <PageHead crumbs={crumbs} title={pageTitle} desc={`${cls.name} · ${fmtDate(week.start)} → ${fmtDate(week.end)}`} />
        {/* Thanh thao tác như màn Kế hoạch năm học: nút cỡ nhỏ viền xanh, nhóm lưu/xuất bên phải (Tiền 05/11) */}
        <div className="ga-year-toolbar" role="group" aria-label="Thao tác giáo án tuần">
          <div className="ga-year-toolbar__group">
            {/* Trạng thái theo kế hoạch chủ đề (giáo án tuần gửi / duyệt cùng kế hoạch chủ đề), đặt ở header như mục tiêu năm học */}
            <EduStatusBadge status={(container || themeDoc)?.status || EDU_STATUS.DRAFT} doc={container || themeDoc} />
            <Link className="btn btn--sm btn--outline-primary" to={days ? `${base}/weeks/${weekStart}` : `${base}/weeks/${weekStart}/days`}>
              {days ? 'Kế hoạch tuần' : 'Giáo án ngày'}
            </Link>
            <button
              type="button"
              className="btn btn--sm btn--outline-primary"
              disabled={!saved || !themeDoc}
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
            {(editable || adjustEditable) && (
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
            {/* Gửi / duyệt ở trang kế hoạch chủ đề: nút lưu rồi sang trang đó */}
            <DocReviewButton
              kind="week"
              doc={saved}
              dossier={container || themeDoc}
              ctx={ctx}
              user={user}
              dirty={saver.unsaved || saver.saving}
              reviewTo={dossierTo}
              onGo={guard.leave}
              onSave={editable || adjustEditable ? saver.save : undefined}
              onGoNow={guard.leaveNow}
              className="btn btn--sm btn--outline-primary"
            />
            {/* In giáo án tuần ở mọi bước (đã duyệt thì in để dạy hằng ngày) */}
            <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setPreview(weekFile(exportArgs))}>
              <FileDown size={16} aria-hidden /> Xuất file
            </button>
            {preview && <DocPreviewModal file={preview} onClose={() => setPreview(null)} />}
          </div>
        </div>
      </div>
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
      <RejectedNotice status={(container || themeDoc)?.status} history={(container || themeDoc)?.history} />
      <Card
        bodyClass={null}
        foot={
          // Chuyển tuần ở cuối trang, dồn sang bên phải (giữ kiểu nút cũ)
          <>
            <span />
            <span className="row gap-2">
              {prev && (
                <Link className="btn btn--ghost btn--sm" to={`${base}/weeks/${prev.start}${days ? '/days' : ''}`}>
                  <ArrowLeft size={16} aria-hidden /> Về tuần {prev.no}
                </Link>
              )}
              {next && (
                <Link className="btn btn--ghost btn--sm" to={`${base}/weeks/${next.start}${days ? '/days' : ''}`}>
                  Sang tuần {next.no} <ArrowRight size={16} aria-hidden />
                </Link>
              )}
            </span>
          </>
        }
      >
        {/* Tên chủ đề nhánh nằm chung thẻ với tab tuần / ngày (Tiền 04/11) */}
        <div className="card__body">
          <div className="ga-week-hero__label">
            Chủ đề nhánh {branchNo} · Tuần {week.no} của năm học
          </div>
          <div className={`ga-week-hero__name ${branchName ? '' : 'muted'}`}>{branchName || 'Chưa đặt tên chủ đề nhánh'}</div>
          <div className="ga-week-hero__meta">
            Chủ đề: {week.theme.name} · {fmtDate(week.start)} → {fmtDate(week.end)}
            {!branchName && canComposeClassDocs && (
              <>
                {' · '}
                <Link to={`/education/branches/${classId}`}>Đặt tên chủ đề nhánh</Link>
              </>
            )}
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
              adjustEditable={adjustEditable}
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
