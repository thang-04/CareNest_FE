import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileDown, Save } from '@/components/ui/icons';
import { Card, DraftRecoveryNotice, EduStatusBadge, Notice, PageHead } from '@/components/education-plan/eduUi';
import { DocStatusStrip, lockTarget, useClassPlanContext } from '@/components/education-plan/planUi';
import { LoadingState } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useManualSave } from '@/hooks/education-plan/useManualSave';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { numberGoals } from '@/models/education-plan/goalTable';
import {
  createBlocker,
  ddmm,
  emptyThemePlan,
  isEditableStatus,
  themeNumber,
  themeGoalBlocks,
  yearWeeks,
} from '@/models/education-plan/classPlan';
import { leaderNameOf, themeFile } from '@/utils/education-plan/classPlanDoc';
import { ThemePlanBody, themeRowOf } from '@/components/education-plan/ThemePlanBody';
import { ActivityResources } from '@/components/education-plan/ActivityResources';
import { themeActivities } from '@/models/education-plan/classPlan';
import { FinishedThemeNote, SupersededNote, VersionCopyOffer, VersionFlagsPanel } from '@/components/education-plan/VersionWidgets';
import { useDocVersion } from '@/hooks/education-plan/useDocVersion';
import { addedGoalIds, checkFlag, danglingRows, dropReference, versionOf } from '@/models/education-plan/planVersions.mjs';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';

/**
 * Kế hoạch giáo dục chủ đề của lớp theo mẫu MN Thái Dương: TT | Mục tiêu (giữ số MT năm) | Nội dung | Hoạt động giáo dục,
 * nhóm theo lĩnh vực / lĩnh vực con; II. Môi trường giáo dục. Mục tiêu và nội dung lấy sẵn từ phần đã tích cho chủ đề ở kế hoạch năm.
 */
export default function ClassThemePlanPage() {
  const { classId, themeId } = useParams();
  return <ThemePlanInner key={`${classId}/${themeId}`} />;
}

function ThemePlanInner() {
  const { classId, themeId } = useParams();
  const { user, classThemePlans, branchPlans, weekPlans, saveClassDoc, toast, staff } = useEducationPlan();
  const [preview, setPreview] = useState(null);
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan, isClassTeacher } = ctx;
  const theme = yearPlan?.themes.find((t) => t.id === themeId);
  const saved = classThemePlans.find((t) => t.classId === classId && t.themeId === themeId) || null;
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [copying, setCopying] = useState(false);
  const version = useDocVersion('theme', saved, ctx, classThemePlans, { themeId });
  const canWrite = isClassTeacher && !ctx.superseded && isEditableStatus(saved?.status || EDU_STATUS.DRAFT);

  // Lưu tay (nút Lưu, Ctrl+S). Lưu cả các dòng chưa sửa để bản đã duyệt giữ nguyên nội dung dù kế hoạch năm đổi sau này
  const saver = useManualSave({
    doc: draft,
    enabled: canWrite,
    save: (doc) => {
      const gs = themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), themeId).flatMap((b) => b.goals);
      // Bản chép: dòng MT đã bị bỏ ở phiên bản mới giữ lại (đỏ) tới khi giáo viên bỏ (BE:EDU-26)
      return saveClassDoc('theme', {
        ...doc,
        rows: { ...danglingRows(doc, yearPlan), ...Object.fromEntries(gs.map((g) => [g.id, themeRowOf(doc, g)])) },
      });
    },
    onSaved: (same) => same && setDirty(false),
    backup: { userId: user?.id, key: yearPlan && `theme:${classId}:${yearPlan.id}:${themeId}` },
    onRestore: (doc) => {
      setDraft(doc);
      setDirty(true);
    },
  });

  const guard = useLeaveGuard({
    when: canWrite && saver.unsaved,
    onSave: saver.save,
  });

  useEffect(() => {
    if (dirty || !yearPlan) return;
    const doc = saved || emptyThemePlan({ classId, yearPlanId: yearPlan.id, themeId });
    setDraft(doc);
    saver.markClean(doc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.status, saved?.history?.length, yearPlan?.id, classId, themeId]);

  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan || !theme) return <StatusPage kind="404" title="Không tìm thấy chủ đề trong kế hoạch năm đã ban hành của lớp" />;
  if (!draft) return <LoadingState />;

  const status = saved?.status || EDU_STATUS.DRAFT;
  const editable = canWrite;
  const copyOld = async () => {
    setCopying(true);
    const doc = await saveClassDoc('theme', version.copy());
    setCopying(false);
    if (doc) toast('Đã chép kế hoạch chủ đề cũ. Sửa các ô đỏ trước khi gửi duyệt.');
  };
  const flagEdit = (fn) => {
    setDraft((d) => fn(d));
    setDirty(true);
  };
  const base = `/education/class/${classId}`;
  const crumbs = [{ label: 'Kế hoạch giáo dục' }, { label: `Kế hoạch ${cls.name}`, to: base }, { label: theme.name }];
  // Mở thẳng đường dẫn khi chưa tới bước này: không hiện biểu mẫu, chỉ ra bước còn thiếu
  const lock = !saved && createBlocker('theme', { classId, yearPlanId: yearPlan.id, themeId }, { branchPlans, classThemePlans });
  if (lock) {
    const target = lockTarget(lock, base, themeId);
    return (
      <div className="page ga-page">
        <PageHead crumbs={crumbs} title={`Kế hoạch giáo dục chủ đề: ${theme.name}`} desc={cls.name} />
        <Notice tone="warn">
          Chưa thể bắt đầu: {lock.message} <Link to={target.to}>{target.label}</Link>
        </Notice>
      </div>
    );
  }
  const numbers = numberGoals(yearPlan.domains);
  const blocks = themeGoalBlocks(yearPlan.domains, numbers, themeId);
  const branch = branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id);
  const weeks = yearWeeks(yearPlan).filter((w) => w.type === 'week' && w.theme.id === themeId);
  // Nội dung lấy nguyên từ kế hoạch năm (không sửa); giáo viên viết hoạt động giáo dục
  const rowOf = (g) => themeRowOf(draft, g);
  const setRow = (g, field, value) => {
    setDraft((d) => ({ ...d, rows: { ...d.rows, [g.id]: { ...rowOf(g), [field]: value } } }));
    setDirty(true);
  };
  const setField = (field, value) => {
    setDraft((d) => ({ ...d, [field]: value }));
    setDirty(true);
  };
  // Hồ sơ chủ đề như file của trường: kế hoạch chủ đề rồi từng tuần nhánh đã soạn (kèm khung duyệt của tuần)
  const exportArgs = {
    themeDoc: draft,
    theme,
    themeNo: themeNumber(yearPlan, themeId),
    cls,
    weeks,
    blocks,
    rowOf,
    weekDocs: weeks
      .map((w, i) => ({
        week: w,
        branchNo: i + 1,
        branchName: branch?.names?.[w.start] || '',
        doc: weekPlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.weekStart === w.start),
      }))
      .filter((w) => w.doc),
  };

  return (
    <div className="page ga-page ga-class-editor">
      <div className="ga-sticky-head">
        <PageHead
          crumbs={crumbs}
          title={`Kế hoạch giáo dục chủ đề: ${theme.name}`}
          desc={<EduStatusBadge status={status} size="lg" />}
          actions={
            <>
              <button
                type="button"
                className="btn btn--outline-primary"
                disabled={!saved}
                onClick={() => guard.leave(`${base}/themes/${themeId}/teach`)}
              >
                Dạy học / Trình chiếu
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() =>
                  setPreview(themeFile({ ...exportArgs, leaderName: leaderNameOf(staff, cls.ageGroupId, yearPlan?.schoolYear) }))
                }
              >
                <FileDown size={16} aria-hidden /> Xuất
              </button>
              {preview && <DocPreviewModal file={preview} onClose={() => setPreview(null)} />}
              {editable && (
                <>
                  <span className="muted text-sm">{saver.label}</span>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={saver.save}
                    disabled={saver.saving || (!saver.unsaved && !saver.error)}
                    title="Lưu (Ctrl+S)"
                  >
                    <Save size={16} aria-hidden /> Lưu
                  </button>
                </>
              )}
            </>
          }
        />
      </div>
      <SupersededNote doc={saved || (ctx.superseded ? { superseded: true, yearPlanVersion: versionOf(yearPlan) } : null)} />
      {!saved && version.finished && <FinishedThemeNote />}
      {!saved && !version.finished && version.prevDoc && !dirty && (
        <VersionCopyOffer
          plan={yearPlan}
          previous={ctx.previousPlan}
          prevDoc={version.prevDoc}
          canCreate={editable}
          busy={copying}
          onTemplate={() => setDirty(true)}
          onCopy={copyOld}
        />
      )}
      <VersionFlagsPanel
        flags={version.flags}
        doc={draft}
        editable={editable}
        onCheck={(f) => flagEdit((d) => checkFlag(d, f))}
        onDrop={(f) => flagEdit((d) => dropReference('theme', d, f))}
      />
      {editable && saver.recovery && <DraftRecoveryNotice onRestore={saver.restoreBackup} onDismiss={saver.dismissRecovery} />}
      {/* Gửi / duyệt cả hồ sơ chủ đề (kế hoạch chủ đề + giáo án các nhánh) ở trang hồ sơ */}
      <DocStatusStrip
        kind="theme"
        doc={saved}
        ctx={ctx}
        user={user}
        dirty={saver.unsaved || saver.saving}
        reviewTo={`${base}/themes/${themeId}/review`}
        onGo={guard.leave}
      />
      <Card title="Chủ đề nhánh" bodyClass={null}>
        <div className="card__body">
          {weeks.length ? (
            <ul className="ga-theme-weeks">
              {weeks.map((w) => (
                <li key={w.start}>
                  <Link className="ga-theme-weeks__link" to={`/education/class/${classId}/weeks/${w.start}`}>
                    <span className="fw-600">
                      Tuần {w.no}: {branch?.names?.[w.start] || 'chưa đặt tên nhánh'}
                    </span>
                    <span className="muted text-sm">
                      {ddmm(w.start)} → {ddmm(w.end)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <span className="muted">Chủ đề chưa có tuần học.</span>
          )}
        </div>
      </Card>
      <ThemePlanBody
        yearPlan={yearPlan}
        themeId={themeId}
        draft={draft}
        editable={editable}
        setRow={setRow}
        setField={setField}
        flagOf={(id) => version.unresolved.find((f) => f.goalId === String(id)) || null}
        added={draft.sourceDocKey ? addedGoalIds(version.changes) : null}
      />
      <ActivityResources
        user={user}
        doc={draft}
        activities={themeActivities(blocks, rowOf)}
        editable={editable}
        exists={!!saved}
        onSave={saver.save}
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
