import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileDown, Save } from '@/components/ui/icons';
import { Card, EduStatusBadge, Notice, PageHead, fmtDate } from '@/components/education-plan/eduUi';
import { getClassDocRelease } from '@/services/education-plan/educationPlanService';
import { submitEntryOf } from '@/models/education-plan/reviewHistory.mjs';
import { VersionHistory } from '@/components/education-plan/VersionHistory';
import { docLines } from '@/models/education-plan/planHistory.mjs';
import { useClassPlanContext } from '@/components/education-plan/planUi';
import { RejectedNotice, ReviewHistory } from '@/components/education-plan/reviewUi';
import { LoadingState } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useManualSave } from '@/hooks/education-plan/useManualSave';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { numberGoals } from '@/models/education-plan/goalTable';
import {
  branchNumber,
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
import {
  addedGoalIds,
  checkFlag,
  danglingRows,
  dropReference,
  versionOf,
} from '@/models/education-plan/planVersions.mjs';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';
import { BlockedNotice, DeadlineBadge } from '@/components/education-plan/DeadlineWidgets';

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
  const {
    user,
    classThemePlans,
    branchPlans,
    weekPlans,
    dayPlans,
    semesterPackages,
    saveClassDoc,
    toast,
    staff,
  } = useEducationPlan();
  const [preview, setPreview] = useState(null);
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan, canComposeClassDocs } = ctx;
  const theme = yearPlan?.themes.find((t) => t.id === themeId);
  const saved = classThemePlans.find((t) => t.classId === classId && t.themeId === themeId) || null;
  // Spec 003: gửi/duyệt theo hồ sơ chủ đề (gốc ds_); bản mock cũ chưa có thì vẫn theo kế hoạch chủ đề
  // Spec 004: kế hoạch chủ đề gửi/duyệt trong học kỳ (gốc sp_) ⇒ trạng thái, hạn, lịch sử lấy theo học kỳ
  const semester =
    semesterPackages.find((p) => p.id === saved?.containerKey) ||
    semesterPackages.find((p) => p.classId === classId && (p.themeIds || []).map(String).includes(String(themeId))) ||
    null;
  const holder = semester || saved;
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [copying, setCopying] = useState(false);
  const [branchFolded, setBranchFolded] = useState(false);
  const version = useDocVersion('theme', saved, ctx, classThemePlans, { themeId });
  const canWrite =
    !ctx.superseded &&
    (saved?.permissions ? saved.permissions.canEdit : saved ? canComposeClassDocs && isEditableStatus(saved.status) : ctx.canCreate('theme'));

  // Lưu tay (nút Lưu, Ctrl+S). Lưu cả các dòng chưa sửa để bản đã duyệt giữ nguyên nội dung dù kế hoạch năm đổi sau này
  const saver = useManualSave({
    doc: draft,
    enabled: canWrite,
    save: (doc) => {
      const gs = themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), themeId, doc?.customTicks).flatMap((b) => b.goals);
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
  }, [saved?.id, saved?.version, saved?.dossierVersion, saved?.status, saved?.history?.length, yearPlan?.id, classId, themeId]);

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
  const crumbs = [{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục chủ đề' }, { label: theme.name }];
  // Mở thẳng đường dẫn khi chưa tới bước này: không hiện biểu mẫu, chỉ ra bước còn thiếu
  const lock = !saved && createBlocker('theme', { classId, yearPlanId: yearPlan.id, themeId }, { branchPlans, classThemePlans });
  if (lock) {
    return (
      <div className="page ga-page">
        <PageHead crumbs={crumbs} title={`Kế hoạch giáo dục chủ đề: ${theme.name}`} desc={cls.name} />
        <Notice tone="warn">
          Chưa thể bắt đầu: {lock.message}
        </Notice>
      </div>
    );
  }
  const numbers = numberGoals(yearPlan.domains);
  const blocks = themeGoalBlocks(yearPlan.domains, numbers, themeId, draft?.customTicks);
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
  const openRelease = async (release) => {
    try {
      const snap = await getClassDocRelease(release.id);
      const content = (kind, weekStart) =>
        (snap.members || []).find((m) => m.kind === kind && (!weekStart || m.weekStart === weekStart))?.content;
      // Bản ban hành của hồ sơ chủ đề có giáo án ngày tách riêng (Q9): ghép lại cho bản xem như file của trường
      const weekContent = (start) =>
        content('week', start) || content('day', start) ? { ...content('week', start), ...content('day', start) } : undefined;
      setPreview(
        themeFile({
          ...exportArgs,
          themeDoc: { ...draft, ...content('theme') },
          weekDocs: exportArgs.weekDocs.map((w) => ({ ...w, doc: weekContent(w.week.start) ? { ...w.doc, ...weekContent(w.week.start) } : undefined })),
          leaderName: leaderNameOf(staff, cls.ageGroupId, yearPlan?.schoolYear),
        }),
      );
    } catch (err) {
      toast(err.message || 'Không mở được bản đã ban hành', 'warn');
    }
  };
  const withDays = (weekDoc, start) => {
    const day = dayPlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.weekStart === start);
    return weekDoc && day ? { ...weekDoc, days: day.days, dayGoals: day.dayGoals, adjustments: day.adjustments } : weekDoc;
  };
  const exportArgs = {
    themeDoc: draft,
    theme,
    themeNo: themeNumber(yearPlan, themeId),
    cls,
    weeks,
    blocks,
    rowOf,
    weekDocs: weeks
      .map((w) => ({
        week: w,
        branchNo: branchNumber(yearPlan, w.start, branch),
        branchName: branch?.names?.[w.start] || '',
        doc: withDays(weekPlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.weekStart === w.start), w.start),
      }))
      .filter((w) => w.doc),
  };


  return (
    <div className="page ga-page ga-class-editor">
      <div className="ga-sticky-head">
        <PageHead crumbs={crumbs} title={`Kế hoạch giáo dục chủ đề: ${theme.name}`} />
        {/* Thanh thao tác như màn Kế hoạch năm học: nút cỡ nhỏ viền xanh, nhóm lưu/gửi/xuất bên phải (Tiền 05/11) */}
        <div className="ga-year-toolbar" role="group" aria-label="Thao tác kế hoạch chủ đề">
          <div className="ga-year-toolbar__group">
            <EduStatusBadge status={holder?.status || status} doc={holder} />
            <DeadlineBadge doc={semester} />
            <button
              type="button"
              className="btn btn--sm btn--outline-primary"
              disabled={!saved}
              title={saved ? undefined : 'Lưu kế hoạch chủ đề trước để dạy học / trình chiếu'}
              onClick={() => guard.leave(`${base}/themes/${themeId}/teach`)}
            >
              Dạy học / Trình chiếu
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
            <button
              type="button"
              className="btn btn--sm btn--outline-primary"
              onClick={() =>
                setPreview(themeFile({ ...exportArgs, leaderName: leaderNameOf(staff, cls.ageGroupId, yearPlan?.schoolYear) }))
              }
            >
              <FileDown size={16} aria-hidden /> Xuất file
            </button>
            {preview && <DocPreviewModal file={preview} onClose={() => setPreview(null)} />}
          </div>
        </div>
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
      <RejectedNotice status={holder?.status} history={holder?.history} />
      <BlockedNotice doc={semester} author={canComposeClassDocs} />
      {holder?.status === 'REVIEW' && submitEntryOf(holder)?.note && (
        // Ghi chú người gửi cho người duyệt (BE spec 002 FR-005)
        <Notice>{`Ghi chú khi gửi (${submitEntryOf(holder).by || '—'}): ${submitEntryOf(holder).note}`}</Notice>
      )}
      <Card title="Chủ đề nhánh" bodyClass={null} collapsed={branchFolded} onToggle={() => setBranchFolded((v) => !v)}>
        <div className="card__body">
          {weeks.length ? (
            <ul className="ga-theme-weeks">
              {weeks.map((w) => (
                <li key={w.start}>
                  <span>
                    Tuần {w.no}: {branch?.names?.[w.start] || 'chưa đặt tên nhánh'}{' '}
                    <span className="muted text-sm">
                      · {ddmm(w.start)} → {ddmm(w.end)}
                    </span>
                  </span>
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
        heading="Mục tiêu, nội dung, hoạt động và môi trường giáo dục"
      />
      <ActivityResources
        user={user}
        doc={draft}
        activities={themeActivities(blocks, rowOf)}
        editable={editable}
        exists={!!saved}
        onSave={saver.save}
      />
      {holder?.history?.length > 0 && <ReviewHistory items={holder.history} open />}
      {holder?.releases?.length > 0 && (
        // Các bản hồ sơ đã ban hành (BE spec 002 FR-018): mở bản xem trước chỉ đọc từ nội dung lúc ban hành
        <Card title="Các bản đã ban hành" className="mt-16">
          <ul className="stack">
            {holder.releases.map((r, i) => (
              <li key={r.id}>
                <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => openRelease(r)}>
                  <FileDown size={16} aria-hidden /> Bản ban hành {i + 1}
                </button>{' '}
                <span className="muted text-sm">
                  {fmtDate(r.releasedAt)}
                  {r.approvedBy ? ` · ${r.approvedBy}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
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
