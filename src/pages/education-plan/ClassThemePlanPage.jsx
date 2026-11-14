import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FileDown, Save, X } from '@/components/ui/icons';
import { Card, EmptyCard, fmtDate, FoldAllButton, Notice, PageHead } from '@/components/education-plan/eduUi';
import { getClassDocRelease, getClassPlans, getGoal, suggestActivityCards } from '@/services/education-plan/educationPlanService';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { submitEntryOf } from '@/models/education-plan/reviewHistory.mjs';
import { VersionHistory } from '@/components/education-plan/VersionHistory';
import { docLines } from '@/models/education-plan/planHistory.mjs';
import { ClassFilterBar, FilterSelect, ThemeBranchTabs, themesWithWeeks, useClassPlanContext } from '@/components/education-plan/planUi';
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
  contentLinesOf,
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
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';
import { BlockedNotice } from '@/components/education-plan/DeadlineWidgets';
import { Button } from '@/components';

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
  const [query] = useSearchParams();
  const coverageTab = query.get('tab') === 'coverage';
  const { user, classThemePlans, branchPlans, weekPlans, dayPlans, semesterPackages, saveClassDoc, toast, staff } = useEducationPlan();
  const [preview, setPreview] = useState(null);
  const ctx = useClassPlanContext(classId);
  const { schoolYears } = useSchoolYear();
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
  // Chỗ ThemePlanBody đặt menu "Lấy / gợi ý hoạt động" ở trái hàng nút
  const [toolsEl, setToolsEl] = useState(null);
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

  // Lấy hoạt động năm trước (Tiền 13/11/2026): kế hoạch chủ đề đã ban hành cùng tên chủ đề của lớp mình ở các năm trước.
  // "Lớp mình" theo phạm vi BE trả về cho người dùng ở từng năm (GV chỉ nhận hồ sơ lớp được phân công)
  const loadPreviousActivities = useCallback(async () => {
    const norm = (t) =>
      String(t || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
    const current = String(yearPlan?.schoolYear || '').replace(/\s*[–-]\s*/, '-');
    const name = norm(yearPlan?.themes.find((t) => t.id === themeId)?.name);
    const prior = schoolYears.filter((y) => String(y.id) < current).sort((a, b) => String(b.id).localeCompare(String(a.id)));
    const sources = [];
    for (const year of prior) {
      const docs = await getClassPlans(year.id, user);
      for (const doc of (docs?.classThemePlans || []).filter((d) => d.status === EDU_STATUS.APPROVED)) {
        const plan = await getGoal(doc.yearPlanId, user);
        if (norm(plan?.themes?.find((t) => String(t.id) === String(doc.themeId))?.name) !== name) continue;
        const goals = themeGoalBlocks(plan.domains, numberGoals(plan.domains), doc.themeId, doc.customTicks).flatMap((b) => b.goals);
        const cards = normalizeTheme(
          doc,
          goals.map((g) => g.id),
        ).filter((c) => c.slot && c.name?.trim());
        if (!cards.length) continue;
        const cls = (docs.classes || []).find((c) => String(c.id) === String(doc.classId));
        sources.push({
          key: doc.id,
          label: `Năm học ${year.label || year.id}${cls?.name ? ` · ${cls.name}` : ''}`,
          cards,
          goals: goals.map((g) => ({ id: g.id, text: g.text, lines: contentLinesOf(themeRowOf(doc, g).contents) })),
        });
      }
    }
    return sources;
  }, [schoolYears, user, yearPlan, themeId]);

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

  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan || !theme) return <StatusPage kind="404" title="Không tìm thấy chủ đề trong kế hoạch năm đã ban hành của lớp" />;
  if (!draft) return <LoadingState />;

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
        {/* Thẻ đầu trang như Kế hoạch tuần / giáo án ngày: hàng lọc Nhóm tuổi · Lớp · Chủ đề, tên chủ đề và tab Kế hoạch chủ đề
            rồi các chủ đề nhánh (Tiền 12/11/2026) */}
        <ClassFilterBar
          classes={ctx.classes}
          classId={classId}
          canPick={ctx.canPickClass}
          onPick={(id) => guard.leave(`/education/theme-plans/${id}`)}
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
        >
          <FilterSelect
            label="Chủ đề"
            value={String(themeId)}
            options={themesWithWeeks(yearPlan).map((t) => ({ value: String(t.id), label: t.name }))}
            onChange={(id) => guard.leave(`/education/class/${classId}/themes/${id}`)}
          />
          {/* Lọc mục tiêu nằm trong thẻ Bảng phủ MT; bỏ "Kiểu hiển thị" dạng cây (Tiền 13/11/2026) */}
        </ClassFilterBar>
        {/* Thanh thao tác như màn Kế hoạch năm học: nút cỡ nhỏ viền xanh, nhóm lưu/gửi/xuất bên phải (Tiền 05/11) */}
        <div className="ga-year-toolbar" role="group" aria-label="Thao tác kế hoạch chủ đề">
          <div className="ga-year-toolbar__group">
            <span className="ga-year-toolbar__title">Chủ đề: {theme.name}</span>
            {/* Trạng thái, hạn chỉ ở thẻ học kỳ trang danh sách (Tiền 14/11/2026) */}
            <FoldAllButton />
            {/* Nút "Thao tác" (Lấy / gợi ý) do ThemePlanBody đặt vào; Xuất file chủ đề chỉ ở thẻ chủ đề trang danh sách */}
            {editable && <span ref={setToolsEl} className="row row--middle gap-2" />}
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
                <Button
                  variant="outline-primary"
                  size="sm"
                  disabled={saver.saving}
                  onClick={() => guard.leave(`/education/theme-plans/${classId}`)}
                >
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
      {coverageTab && (
        <CoverageTab
          blocks={blocks}
          cards={coverageCards}
          weeks={coverageWeeks}
          contentsOf={(g) => rowOf(g).contents}
          onOpen={(start, day) => guard.leave(`/education/class/${classId}/weeks/${start}#cov-day-${day}`)}
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
          loadPreviousActivities={editable ? loadPreviousActivities : null}
          suggestActivities={editable ? suggestActivityCards : null}
          notify={toast}
          toolsTarget={toolsEl}
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
