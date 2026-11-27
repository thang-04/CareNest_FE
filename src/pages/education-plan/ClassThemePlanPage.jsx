import { ResponsiveToolbar } from '@/components/ui/ResponsiveToolbar';
import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FileDown, Save, X, Pencil } from '@/components/ui/icons';
import { Card, EmptyCard, fmtDate, FoldAllButton, Notice, PageHead, EduStatusBadge } from '@/components/education-plan/eduUi';
import { getClassDocRelease, rewriteClassContents, suggestActivityCards } from '@/services/education-plan/educationPlanService';
import { submitEntryOf } from '@/models/education-plan/reviewHistory.mjs';
import { VersionHistory } from '@/components/education-plan/VersionHistory';
import { docLines } from '@/models/education-plan/planHistory.mjs';
import { ClassFilterBar, ThemeBranchTabs, useClassPlanContext } from '@/components/education-plan/planUi';
import { RejectedNotice, ReviewHistory } from '@/components/education-plan/reviewUi';
import { LoadingState } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useDocEditMode } from '@/hooks/education-plan/useDocEditMode';
import { useManualSave } from '@/hooks/education-plan/useManualSave';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { numberGoals } from '@/models/education-plan/goalTable';
import {
  branchNumber,
  createBlocker,
  emptyThemePlan,
  isEditableStatus,
  normalizeTheme,
  themeNumber,
  themeGoalBlocks,
  yearWeeks,
} from '@/models/education-plan/classPlan';
import { leaderNameOf, themeFile } from '@/utils/education-plan/classPlanDoc';
import { ThemePlanBody, themeRowOf } from '@/components/education-plan/ThemePlanBody';
import { CoverageTab } from '@/components/education-plan/CoverageTab';
import { FinishedThemeNote, SupersededNote, VersionCopyOffer, VersionFlagsPanel } from '@/components/education-plan/VersionWidgets';
import { useDocVersion } from '@/hooks/education-plan/useDocVersion';
import { addedGoalIds, checkFlag, danglingRows, dropReference, versionOf } from '@/models/education-plan/planVersions.mjs';
import { classPlanVersionPath } from '@/models/education-plan/planVersions.mjs';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';
import { BlockedNotice, DeadlineBadge } from '@/components/education-plan/DeadlineWidgets';
import { Button } from '@/components';
import { SemesterProgress } from '@/components/education-plan/SemesterProgress';

/**
 * Kế hoạch giáo dục chủ đề của lớp theo mẫu MN Thái Dương: TT | Mục tiêu (giữ số MT năm) | Nội dung | Hoạt động giáo dục,
 * nhóm theo lĩnh vực / lĩnh vực con; II. Môi trường giáo dục. Mục tiêu và nội dung lấy sẵn từ phần đã tích cho chủ đề ở kế hoạch năm.
 */
export default function ClassThemePlanPage() {
  const { classId, themeId } = useParams();
  const [params] = useSearchParams();
  return <ThemePlanInner key={`${classId}/${themeId}/${params.get('plan') || ''}`} />;
}

function ThemePlanInner() {
  const { classId, themeId } = useParams();
  const [query] = useSearchParams();
  const coverageTab = query.get('tab') === 'coverage';
  const { user, classThemePlans, branchPlans, weekPlans, dayPlans, semesterPackages, saveClassDoc, toast, staff } = useEducationPlan();
  const [preview, setPreview] = useState(null);
  const ctx = useClassPlanContext(classId);
  const { cls, yearPlan, canComposeClassDocs } = ctx;
  const theme = yearPlan?.themes.find((t) => t.id === themeId);
  const saved = classThemePlans.find((t) => t.classId === classId && t.yearPlanId === yearPlan?.id && t.themeId === themeId) || null;
  // Spec 003: gửi/duyệt theo kế hoạch giáo dục ngày (gốc ds_); bản mock cũ chưa có thì vẫn theo kế hoạch chủ đề
  // Spec 004: kế hoạch chủ đề gửi/duyệt trong học kỳ (gốc sp_) ⇒ trạng thái, hạn, lịch sử lấy theo học kỳ
  const semester =
    semesterPackages.find((p) => p.id === saved?.containerKey) ||
    semesterPackages.find(
      (p) => p.classId === classId && p.yearPlanId === yearPlan?.id && (p.themeIds || []).map(String).includes(String(themeId)),
    ) ||
    null;
  const holder = semester || saved;
  const [editMode, setEditMode] = useDocEditMode(`${user?.id}:theme:${classId}`);
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  // Chỗ ThemePlanBody đặt menu "Lấy / gợi ý hoạt động" ở trái hàng nút
  const [copying, setCopying] = useState(false);
  const version = useDocVersion('theme', saved, ctx, classThemePlans, { themeId });
  const canWrite =
    !ctx.superseded &&
    (saved?.permissions
      ? saved.permissions.canEdit
      : saved
        ? canComposeClassDocs && isEditableStatus(saved.status)
        : ctx.canCreate('theme'));

  // Lưu tay (nút Lưu, Ctrl+S). Lưu cả các dòng chưa sửa để bản đã duyệt giữ nguyên nội dung dù kế hoạch năm đổi sau này
  const saver = useManualSave({
    doc: draft,
    enabled: canWrite,
    save: (doc) => {
      const gs = themeGoalBlocks(yearPlan.domains, numberGoals(yearPlan.domains), themeId, doc?.customTicks).flatMap((b) => b.goals);
      // Bản chép: dòng MT đã bị bỏ ở phiên bản mới giữ lại (đỏ) tới khi giáo viên bỏ (BE:EDU-26)
      // EDU-78: hoạt động lưu thành thẻ (bản cũ chuyển khi lưu); dòng MT chỉ giữ nội dung (bản chụp)
      return saveClassDoc('theme', {
        ...doc,
        // Thẻ cũ của MT ngoài chủ đề (server dựng khi đọc) không lưu thành thẻ rỗng MT
        activities: normalizeTheme(
          doc,
          gs.map((g) => g.id),
        ).filter((c) => !c.legacy || (c.goalIds || []).some((id) => gs.some((g) => String(g.id) === String(id)))),
        rows: {
          ...danglingRows(doc, yearPlan),
          ...Object.fromEntries(gs.map((g) => [g.id, { contents: themeRowOf(doc, g).contents }])),
        },
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
    // dirty: lưu xong phải nạp lại bản đã lưu để mang số phiên bản mới, nếu không lần lưu kế tiếp bị từ chối (409)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.version, saved?.dossierVersion, saved?.status, saved?.history?.length, yearPlan?.id, classId, themeId, dirty]);

  // BE EDU-112 (4): mở thẳng một bản đã ban hành từ trang danh sách (?release=<id>); hàm mở gán sau khi trang dựng xong
  const openReleaseRef = useRef(null);
  const openedRelease = useRef('');
  const wantRelease = query.get('release') || '';
  useEffect(() => {
    const release = holder?.releases?.find((r) => String(r.id) === wantRelease);
    if (!release || openedRelease.current === wantRelease || !openReleaseRef.current) return;
    openedRelease.current = wantRelease;
    openReleaseRef.current(release);
  });

  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan || !theme) return <StatusPage kind="404" title="Không tìm thấy chủ đề trong kế hoạch năm đã ban hành của lớp" />;
  if (!canComposeClassDocs && !saved)
    return <StatusPage kind="404" title="Kế hoạch chủ đề chưa được ban hành hoặc không thuộc phạm vi xem" />;
  const planPath = (path) => classPlanVersionPath(path, ctx.superseded ? yearPlan.id : null);
  if (!draft) return <LoadingState />;

  const editable = canWrite && editMode;
  const copyOld = async () => {
    setCopying(true);
    const doc = await saveClassDoc('theme', version.copy());
    setCopying(false);
    if (doc) toast('Đã chép kế hoạch chủ đề cũ. Sửa các ô đỏ trước khi gửi duyệt.');
  };
  // Bỏ cờ đang sửa thì trang nạp lại bản đã lưu (bỏ thay đổi khi chọn "Không lưu")
  const stopEditing = () => {
    setDirty(false);
    setEditMode(false);
  };
  const flagEdit = (fn) => {
    setDraft((d) => fn(d));
    setDirty(true);
  };
  const crumbs = [{ label: 'Kế hoạch giáo dục' }, { label: 'Kế hoạch giáo dục chủ đề' }, { label: theme.name }];
  // Mở thẳng đường dẫn khi chưa tới bước này: không hiện biểu mẫu, chỉ ra bước còn thiếu
  const lock = !saved && createBlocker('theme', { classId, yearPlanId: yearPlan.id, themeId }, { branchPlans, classThemePlans });
  if (lock) {
    return (
      <div className="page ga-page">
        <PageHead crumbs={crumbs} title={`Kế hoạch giáo dục chủ đề: ${theme.name}`} />
        <EmptyCard title="Chưa có kế hoạch chủ đề này" />
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
  // Kế hoạch giáo dục ngày như file của trường: kế hoạch chủ đề rồi từng tuần nhánh đã soạn (kèm khung duyệt của tuần)
  const openRelease = async (release) => {
    try {
      const snap = await getClassDocRelease(release.id);
      const content = (kind, weekStart) =>
        (snap.members || []).find((m) => m.kind === kind && (!weekStart || m.weekStart === weekStart))?.content;
      // Bản ban hành của kế hoạch giáo dục ngày có giáo án ngày tách riêng (Q9): ghép lại cho bản xem như file của trường
      const weekContent = (start) =>
        content('week', start) || content('day', start) ? { ...content('week', start), ...content('day', start) } : undefined;
      setPreview(
        themeFile({
          ...exportArgs,
          themeDoc: { ...draft, ...content('theme') },
          weekDocs: exportArgs.weekDocs.map((w) => ({
            ...w,
            doc: weekContent(w.week.start) ? { ...w.doc, ...weekContent(w.week.start) } : undefined,
          })),
          leaderName: leaderNameOf(staff, cls.ageGroupId, yearPlan?.schoolYear),
        }),
      );
    } catch (err) {
      toast(err.message || 'Không mở được bản đã ban hành', 'warn');
    }
  };
  openReleaseRef.current = openRelease;
  const withDays = (weekDoc, start) => {
    const day = dayPlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.weekStart === start);
    return weekDoc && day ? { ...weekDoc, days: day.days, dayGoals: day.dayGoals } : weekDoc;
  };
  // FR-023: người soạn thấy bản lưu mới nhất (kể cả bản tuần sửa theo hồ sơ đang nháp); người khác thấy bản hiệu lực (BE effectiveWeek)
  const coverageWeeks = weeks.map((w) => {
    const wp = weekPlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.weekStart === w.start) || null;
    const dp = dayPlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.weekStart === w.start) || null;
    const edited = !!dp?.week && (canComposeClassDocs || dp.effectiveWeek === 'dossier');
    return { start: w.start, no: w.no, offDays: w.offDays, doc: edited ? { ...wp, ...dp.week } : wp, edited };
  });
  const coverageCards = [
    ...normalizeTheme(
      draft,
      blocks.flatMap((b) => b.goals.map((g) => g.id)),
    ),
    ...coverageWeeks.flatMap((w) => (w.edited ? w.doc.cards || [] : [])),
  ];
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
        doc: withDays(
          weekPlans.find((x) => x.classId === classId && x.yearPlanId === yearPlan.id && x.weekStart === w.start),
          w.start,
        ),
      }))
      .filter((w) => w.doc),
  };

  return (
    <div className="page ga-page ga-class-editor">
      <div className="ga-sticky-head">
        <PageHead crumbs={crumbs} title={`Kế hoạch giáo dục chủ đề: ${theme.name}`} />
        <ResponsiveToolbar className="ga-year-toolbar" role="group" aria-label="Thao tác kế hoạch chủ đề">
          <div className="ga-year-toolbar__group">
            {/* Trạng thái, hạn của học kỳ ở đầu trang như kế hoạch năm (Tiền 28/11/2026) */}
            {semester && !semester.unreleased && (
              <>
                <EduStatusBadge status={semester.status} doc={semester} />
                <DeadlineBadge doc={semester} />
              </>
            )}
            <FoldAllButton />
            {/* Lấy / gợi ý hoạt động ở nút "Thao tác" trong card I (Tiền 18/11/2026); Xuất file chủ đề chỉ ở thẻ chủ đề trang danh sách */}
          </div>
          <div className="ga-year-toolbar__group ga-year-toolbar__group--end">
            {canWrite && !editMode && (
              <Button variant="primary" size="sm" icon={Pencil} onClick={() => setEditMode(true)}>
                {saved ? 'Chỉnh sửa' : 'Soạn'}
              </Button>
            )}
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
                {/* Hủy về chế độ xem, còn thay đổi chưa lưu thì hỏi (Tiền 28/11/2026) */}
                <Button variant="outline-primary" size="sm" disabled={saver.saving} onClick={() => guard.leave(stopEditing)}>
                  <X size={16} aria-hidden /> Hủy
                </Button>
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
        </ResponsiveToolbar>
        {/* Thẻ đầu trang: tên chủ đề và tab Kế hoạch chủ đề rồi các chủ đề nhánh; không có hàng lọc (chỉ trang danh sách có) */}
        <ClassFilterBar
          filters={false}
          footer={
            <>
              <div className="card__body">
                {/* Thẻ tên một dòng (Tiền 13/11/2026): lớp, chủ đề đã có ở hàng lọc nên không lặp lại */}
                <div className="ga-week-hero__name">
                  {theme.name}
                  {weeks.length > 0 && (
                    <span className="ga-week-hero__meta">
                      {' '}
                      · {fmtDate(weeks[0].start)} → {fmtDate(weeks[weeks.length - 1].end)} · {weeks.length} tuần
                    </span>
                  )}
                </div>
              </div>
              <ThemeBranchTabs
                yearPlan={yearPlan}
                branchDoc={branch}
                themeId={themeId}
                classId={classId}
                current={coverageTab ? 'coverage' : 'theme'}
                onGo={guard.leave}
                weeksDisabledReason={saved ? '' : 'Lưu kế hoạch chủ đề trước'}
              />
            </>
          }
        />
        {/* Thanh thao tác như màn Kế hoạch năm học: nút cỡ nhỏ viền xanh, nhóm lưu/gửi/xuất bên phải (Tiền 05/11) */}
      </div>
      <SemesterProgress classId={classId} themeId={themeId} />
      {canComposeClassDocs && (
        <SupersededNote doc={saved || (ctx.superseded ? { superseded: true, yearPlanVersion: versionOf(yearPlan) } : null)} />
      )}
      {canComposeClassDocs && !saved && version.finished && <FinishedThemeNote />}
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
        <Notice tone="info">{`Ghi chú khi gửi (${submitEntryOf(holder).by || '—'}): ${submitEntryOf(holder).note}`}</Notice>
      )}
      {coverageTab && (
        <CoverageTab
          blocks={blocks}
          cards={coverageCards}
          weeks={coverageWeeks}
          contentsOf={(g) => rowOf(g).contents}
          onOpen={(start, day) => guard.leave(planPath(`/education/class/${classId}/weeks/${start}#cov-day-${day}`))}
        />
      )}
      {!coverageTab && (
        <ThemePlanBody
          yearPlan={yearPlan}
          themeId={themeId}
          draft={draft}
          editable={editable}
          setRow={setRow}
          setField={setField}
          flagOf={(id) => version.unresolved.find((f) => f.goalId === String(id)) || null}
          added={draft.sourceDocKey ? addedGoalIds(version.changes) : null}
          suggestActivities={editable ? suggestActivityCards : null}
          rewriteContents={editable ? (body) => rewriteClassContents({ ...body, classId, yearPlanId: yearPlan.id }) : null}
          unsaved={saver.unsaved}
          notify={toast}
          usedCellsOf={(cardId) =>
            weekPlans
              .filter((w) => w.classId === classId && w.yearPlanId === yearPlan.id && w.themeId === themeId)
              .reduce(
                (n, w) => n + Object.values(w.picks || {}).filter((list) => (list || []).some((p) => (p.cardId ?? p.id) === cardId)).length,
                0,
              )
          }
        />
      )}
      {holder?.history?.length > 0 && <ReviewHistory items={holder.history} open />}
      {holder?.releases?.length > 0 && (
        // Các bản hồ sơ đã ban hành (BE spec 002 FR-018): mở bản xem trước chỉ đọc từ nội dung lúc ban hành
        <Card title="Các bản đã ban hành" className="mt-16">
          <ul className="stack">
            {holder.releases.map((r, i) => (
              <li key={r.id}>
                <Button variant="outline-primary" size="sm" onClick={() => openRelease(r)}>
                  <FileDown size={16} aria-hidden /> Bản ban hành {i + 1}
                </Button>{' '}
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
