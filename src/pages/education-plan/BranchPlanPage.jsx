import {
  adaptCalendar,
  branchDisplayRows,
  branchWeeks,
  calendarDurationIssue,
  resizeBranch,
  seedTeamBranchTemplates,
  teachingWeeks,
  updateWeek,
} from '@/models/education-plan/branchCalendar.mjs';
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Check, Download, FileDown, Lightbulb, Pencil, Save, Wand2, X } from '@/components/ui/icons';
import { branchFile, leaderNameOf } from '@/utils/education-plan/classPlanDoc';
import { rewriteBranchName, suggestBranchNames } from '@/services/education-plan/educationPlanService';
import { Card, fmtDate, Notice, PageHead } from '@/components/education-plan/eduUi';
import DatePickerCell from '@/components/education-plan/DatePickerCell';
import { VersionHistory } from '@/components/education-plan/VersionHistory';
import { docLines } from '@/models/education-plan/planHistory.mjs';
import { Cell, ClassFilterBar, ClassPageEmpty, FilterSelect, focusCell, useClassPlanContext } from '@/components/education-plan/planUi';
import { RejectedNotice } from '@/components/education-plan/reviewUi';
import { LoadingState } from '@/components/ui/States';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { Modal } from '@/components/ui/Modal';
import { useAiRun } from '@/hooks/useAiRun';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useManualSave } from '@/hooks/education-plan/useManualSave';
import { usePolling } from '@/hooks/usePolling';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import {
  branchGrid,
  ddmm,
  emptyBranchPlan,
  isEditableStatus,
  monthOf,
  offDaysText,
  semesterChoices,
} from '@/models/education-plan/classPlan';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { SupersededNote, VersionCopyOffer, VersionFlagsPanel } from '@/components/education-plan/VersionWidgets';
import { useDocVersion } from '@/hooks/education-plan/useDocVersion';
import { checkFlag, dropReference, versionOf } from '@/models/education-plan/planVersions.mjs';
import DocPreviewModal from '@/components/education-plan/DocPreviewModal';
import { ImportBranchFileModal } from '@/components/education-plan/ImportBranchFileModal';
import { applyBranchFile, branchPayload } from '@/models/education-plan/importBranchFile.mjs';
import { DocTable } from '@/components/ui/DocTable';

/**
 * "Dự kiến chủ đề - chủ đề nhánh" theo mẫu MN Thái Dương.
 * Tháng | Chủ đề (gộp dòng) | Chủ đề nhánh (giáo viên gõ) | Tuần (đánh số cả năm, dòng nghỉ) | Ghi chú.
 * Lịch nhánh gửi/duyệt theo học kỳ ở trang Kế hoạch giáo dục chủ đề (spec 004); trang này chỉ để sửa, không liên kết sang trang khác.
 */
export default function BranchPlanPage() {
  const { classId } = useParams();
  // Đổi lớp thì dựng lại trang để bỏ bản sửa dở của lớp trước
  const { yearPlan } = useClassPlanContext(classId);
  return <BranchPlanInner key={`${classId}:${yearPlan?.id}:${yearPlan?.curriculumSourcePlanId || 'legacy'}`} classId={classId} />;
}

// Bản gửi đi khi lưu: ô AI chưa ✓ / ✗ vẫn lưu tên trước đó, chỉ lưu khi giáo viên đã giữ
const payloadOf = branchPayload;

/** Đường dẫn cũ /education/class/:classId/branches(/review). */
export function BranchPlanLegacyRedirect() {
  const { classId } = useParams();
  return <Navigate to={`/education/branches/${classId}`} replace />;
}

function BranchPlanInner({ classId }) {
  const { user, branchPlans, semesterPackages, semesterConfigMissing, saveClassDoc, toast, eduConfig, staff, refreshClassDocs } =
    useEducationPlan();
  const [preview, setPreview] = useState(null);
  const [importContext, setImportContext] = useState(null);
  const [editing, setEditing] = useState(false);
  const [pendingDates, setPendingDates] = useState({});
  const ctx = useClassPlanContext(classId);
  const { cls, classes, yearPlan: sourcePlan, teachers, canComposeClassDocs } = ctx;
  const yearPlan = sourcePlan;
  const saved = yearPlan ? branchPlans.find((b) => b.classId === classId && b.yearPlanId === yearPlan.id) || null : null;
  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  // AI điền thẳng vào ô; tuần còn chờ giáo viên bấm giữ (✓) hoặc bỏ (✗): { [weekStart]: { prev, base } }
  // prev: tên trước khi AI đụng vào (✗ trả về), base: tên dùng để viết lại
  const [pending, setPending] = useState({});
  const [aiTheme, setAiTheme] = useState(null);
  // AI viết lại tên đã có: tuần đang chờ kết quả và số lần đã viết lại (mỗi lần một cách khác)
  const [rewriting, setRewriting] = useState(null);
  const { run: runAi } = useAiRun();
  const [showPending, setShowPending] = useState(false);
  const [tries, setTries] = useState({});
  // Hộp xác nhận trước mỗi lần dùng AI: { title, message, confirmLabel, run }
  const [confirm, setConfirm] = useState(null);
  const [copying, setCopying] = useState(false);
  const [view, setView] = useState('list');
  const [semesterNo, setSemesterNo] = useState('');
  const { schoolYear: yearId, schoolYears } = useSchoolYear();
  const version = useDocVersion('branch', saved, ctx, branchPlans);
  const autoOk =
    !ctx.superseded &&
    (saved?.permissions
      ? saved.permissions.canEdit
      : saved
        ? canComposeClassDocs && isEditableStatus(saved.status)
        : ctx.canCreate('branch'));
  const payload = payloadOf(draft, pending);
  const hasPending = Object.keys(pending).length > 0;
  // Lưu tay (nút Lưu, Ctrl+S); rời trang khi chưa lưu thì hỏi
  const saver = useManualSave({
    doc: payload,
    enabled: autoOk,
    save: (doc) => saveClassDoc('branch', doc),
    // Lưu xong vẫn ở chế độ sửa như các màn kế hoạch khác (thoát bằng Hủy); còn ô AI chờ ✓ / ✗ thì giữ bản đang sửa
    onSaved: (same) => {
      if (same && !hasPending) setDirty(false);
    },
    backup: { userId: user?.id, key: yearPlan && `branch:${classId}:${yearPlan.id}` },
    onRestore: (doc) => {
      setDraft(eduConfig.durationPolicyAvailable === false ? doc : adaptCalendar(doc, yearPlan));
      setDirty(true);
      setEditing(true);
    },
  });
  const guard = useLeaveGuard({ when: editing && autoOk && saver.unsaved, onSave: saver.save });
  // Đang xem (không sửa): trạng thái gói học kỳ do người khác đổi tự cập nhật; đang sửa thì không nạp lại để giữ bản đang gõ
  usePolling(() => refreshClassDocs?.().catch(() => {}), { enabled: !editing });

  useEffect(() => {
    setEditing(false);
    setPendingDates({});
  }, [classId, yearPlan?.id]);

  useEffect(() => {
    // Kế hoạch tổ chưa tải xong chi tiết thì chưa dựng bản nháp
    if (dirty || !yearPlan) return;
    const doc = saved || emptyBranchPlan({ classId, yearPlanId: yearPlan.id });
    const adapted =
      doc &&
      (eduConfig.durationPolicyAvailable === false && saved
        ? doc
        : adaptCalendar(
            {
              ...doc,
              durationPolicySnapshot:
                doc.durationPolicySnapshot ||
                (eduConfig.durationPolicyAvailable === false
                  ? { mode: 'LEGACY_UNBOUNDED' }
                  : { mode: 'BOUNDED', ...eduConfig.durationPolicy }),
            },
            yearPlan,
          ));
    const mapped = adapted?.schemaVersion === 2 ? seedTeamBranchTemplates(adapted, yearPlan) : adapted;
    setDraft(mapped);
    saver.markClean(mapped && mapped !== adapted ? adapted : mapped);
    // dirty: lưu xong phải nạp lại bản đã lưu để mang số phiên bản mới, nếu không lần lưu kế tiếp bị từ chối (409)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.version, saved?.dossierVersion, saved?.status, saved?.history?.length, yearPlan?.id, classId, dirty]);

  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan)
    return (
      <ClassPageEmpty
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Dự kiến chủ đề - chủ đề nhánh' }]}
        title="Dự kiến chủ đề - chủ đề nhánh"
        classes={classes}
        classId={classId}
        onPick={(id) => guard.leave(`/education/branches/${id}`)}
        emptyTitle={cls ? 'Kế hoạch giáo dục tổ của nhóm tuổi này chưa được ban hành' : 'Không tìm thấy lớp'}
      />
    );
  if (!draft) return <LoadingState />;

  const status = saved?.status || EDU_STATUS.DRAFT;
  const packages = semesterPackages.filter((p) => p.classId === classId && p.yearPlanId === yearPlan?.id);
  const choices = semesterChoices(
    schoolYears.find((y) => String(y.id) === String(yearId)),
    yearPlan.themes.filter((t) => t.start && t.end),
    packages,
  );
  const selectedPackage = choices.find((c) => String(c.semesterNo) === semesterNo) || null;
  const visibleThemeIds = selectedPackage ? new Set(selectedPackage.themeIds) : null;
  const inSemester = (row) => !visibleThemeIds || visibleThemeIds.has(String(row.theme.id));
  const canEdit = autoOk;
  // Chép chủ đề nhánh của phiên bản trước sang phiên bản mới (BE:EDU-26)
  const copyOld = async () => {
    setCopying(true);
    const doc = await saveClassDoc('branch', version.copy());
    setCopying(false);
    if (doc) toast('Đã chép chủ đề nhánh cũ. Sửa các mục đỏ rồi gửi duyệt lại.');
  };
  // Hủy chỉnh sửa: về bản đã lưu, thoát chế độ sửa; còn thay đổi chưa lưu thì hỏi lại
  const cancelEdit = () => {
    const run = () => {
      saver.discardBackup();
      setPending({});
      setPendingDates({});
      const clean = saver.cleanDoc();
      if (clean) setDraft(clean);
      setDirty(false);
      setEditing(false);
    };
    if (saver.unsaved || hasPending)
      setConfirm({ danger: true, title: 'Hủy chỉnh sửa', message: 'Các thay đổi chưa lưu sẽ bị bỏ.', confirmLabel: 'Hủy chỉnh sửa', run });
    else run();
  };
  const flagEdit = (fn) => {
    setDraft((d) => fn(d));
    setDirty(true);
  };
  const editable = editing && canEdit;
  const dateIssue = calendarDurationIssue(draft, yearPlan);
  const branchForWeek = (row) =>
    draft.branches.find(
      (branch) => String(branch.themeId) === String(row.theme.id) && row.start >= branch.startDate && row.start <= branch.endDate,
    );
  const allRows = branchDisplayRows(yearPlan, draft);
  const displayRows = allRows.filter(inSemester);
  const mappedWeeks = allRows.filter((r) => r.type === 'week' && branchForWeek(r));
  const weekCount = mappedWeeks.length;
  const empty = mappedWeeks.filter((r) => !draft.names[r.start]?.trim()).length;
  const set = (field, key, value) => {
    setDraft((d) =>
      d.schemaVersion === 2 ? updateWeek(d, yearPlan, field, key, value) : { ...d, [field]: { ...d[field], [key]: value } },
    );
    setDirty(true);
  };
  const settle = (week) =>
    setPending((p) => {
      const { [week]: _, ...rest } = p;
      return rest;
    });
  // Gợi ý các tuần còn trống: của một chủ đề, hoặc cả năm khi theme = null
  const askAi = async (theme) => {
    const weekRows = mappedWeeks;
    const targets = weekRows.filter((r) => (!theme || r.theme.id === theme.id) && !draft.names[r.start]?.trim() && branchForWeek(r));
    if (!targets.length) return toast(theme ? 'Các tuần của chủ đề này đã có tên chủ đề nhánh' : 'Cả năm đã có tên chủ đề nhánh');
    const taken = weekRows.filter((r) => !targets.includes(r)).map((r) => draft.names[r.start] || '');
    const themes = [...new Map(targets.map((r) => [r.theme.id, r.theme])).values()].map((t) => ({
      id: t.id,
      name: t.name,
      festivals: t.festivals || '',
      weeks: targets.filter((r) => r.theme.id === t.id).map((r) => ({ start: r.start, no: r.no })),
    }));
    setAiTheme(theme ? theme.id : 'all');
    try {
      const res = await runAi(() => suggestBranchNames({ classId, ageGroupId: cls.ageGroupId, themes, taken }));
      res.suggestions.forEach((x) => set('names', x.weekStart, x.name));
      setPending((p) => ({
        ...p,
        ...Object.fromEntries(res.suggestions.map((x) => [x.weekStart, { prev: draft.names[x.weekStart] || '', base: x.name }])),
      }));
      if (res.suggestions.length) setShowPending(true);
    } catch {
      toast('Chưa lấy được gợi ý. Bạn vẫn có thể tự nhập tên chủ đề nhánh.', 'warn');
    } finally {
      setAiTheme(null);
    }
  };
  // Giáo viên sửa ô đang chờ: lần viết lại sau dựa trên chữ vừa sửa
  const editName = (week, value) => {
    // Nhập tên trước khi chọn ngày: tuần chưa có nhánh tự thành nhánh 1 tuần, đổi ngày sau
    set('names', week, value);
    setPendingDates((dates) => {
      const { [week]: _, ...rest } = dates;
      return rest;
    });
    setPending((p) => (p[week] ? { ...p, [week]: { ...p[week], base: value } } : p));
  };
  const rewrite = async (r) => {
    // Mỗi lần bấm viết lại từ cùng một tên gốc, không chồng lên bản AI trước
    const p0 = pending[r.start];
    const current = p0?.base ?? (draft.names[r.start] || '');
    setRewriting(r.start);
    try {
      const res = await runAi(() => rewriteBranchName({ classId, name: current, themeName: r.theme.name, attempt: tries[r.start] || 0 }));
      setTries((t) => ({ ...t, [r.start]: (t[r.start] || 0) + 1 }));
      set('names', r.start, res.name);
      // ✗ trả về tên gốc của giáo viên
      setPending((p) => ({ ...p, [r.start]: { prev: p0 ? p0.prev : current, base: current } }));
      setShowPending(true);
    } catch {
      toast('Chưa viết lại được. Bạn vẫn có thể tự sửa tên.', 'warn');
    } finally {
      setRewriting(null);
    }
  };
  // Viết lại mọi tuần đã có tên trong năm, mỗi tuần vào trạng thái chờ ✓ / ✗ như viết lại từng ô
  const rewriteAll = async () => {
    const named = mappedWeeks.filter((r) => draft.names[r.start]?.trim());
    if (!named.length) return toast('Chưa có tên chủ đề nhánh nào để viết lại');
    setAiTheme('rewrite');
    try {
      const results = await runAi(() =>
        Promise.all(
          named.map((r) => {
            const base = pending[r.start]?.base ?? draft.names[r.start];
            return rewriteBranchName({ classId, name: base, themeName: r.theme.name, attempt: tries[r.start] || 0 }).then((res) => ({
              r,
              base,
              name: res.name,
            }));
          }),
        ),
      );
      results.forEach((x) => set('names', x.r.start, x.name));
      setTries((t) => ({ ...t, ...Object.fromEntries(named.map((r) => [r.start, (t[r.start] || 0) + 1])) }));
      setPending((p) => ({
        ...p,
        ...Object.fromEntries(results.map((x) => [x.r.start, { prev: p[x.r.start]?.prev ?? x.base, base: x.base }])),
      }));
      setShowPending(true);
    } catch {
      toast('Chưa viết lại được. Bạn vẫn có thể tự sửa tên.', 'warn');
    } finally {
      setAiTheme(null);
    }
  };
  const rejectAi = (week) => {
    set('names', week, pending[week].prev);
    settle(week);
  };
  const pendingWeeks = Object.keys(pending);
  const rejectAll = () => {
    pendingWeeks.forEach((w) => set('names', w, pending[w].prev));
    setPending({});
  };
  // Bỏ nhiều gợi ý một lần: hỏi trước như mọi thao tác xóa (quy tắc trang kế hoạch năm)
  const confirmRejectAll = () =>
    setConfirm({
      danger: true,
      title: `Bỏ cả ${pendingWeeks.length} tên AI điền?`,
      message: 'Các tuần này trở về tên trước khi AI điền (để trống nếu trước đó chưa có tên).',
      confirmLabel: 'Bỏ tất cả',
      run: rejectAll,
    });
  const aiBusy = !!aiTheme || !!rewriting;
  const printArgs = { doc: saved || draft, cls, yearPlan, teachers, leaderName: leaderNameOf(staff, cls.ageGroupId, yearPlan?.schoolYear) };
  // Hỏi trước khi chạy AI; kết quả là bản nháp để giáo viên giữ / bỏ
  const confirmSuggest = (theme) => {
    const n = mappedWeeks.filter((r) => (!theme || r.theme.id === theme.id) && !draft.names[r.start]?.trim()).length;
    if (!n) return toast(theme ? 'Các tuần của chủ đề này đã có tên chủ đề nhánh' : 'Cả năm đã có tên chủ đề nhánh');
    setConfirm({
      title: theme ? `AI gợi ý cho "${theme.name}"?` : 'AI gợi ý cả năm?',
      message: `AI sẽ đặt tên chủ đề nhánh cho ${n} tuần còn trống.`,
      confirmLabel: 'Dùng AI gợi ý',
      run: () => askAi(theme),
    });
  };
  const confirmRewriteAll = () => {
    const n = mappedWeeks.filter((r) => draft.names[r.start]?.trim()).length;
    setConfirm({
      title: 'AI viết lại cả năm?',
      message: `AI sẽ viết lại ${n} tên chủ đề nhánh cho hay hơn.`,
      confirmLabel: 'Dùng AI viết lại',
      run: rewriteAll,
    });
  };
  const confirmRewrite = (r) =>
    setConfirm({
      title: `AI viết lại tuần ${r.no}?`,
      message: 'AI sẽ viết lại tên chủ đề nhánh cho hay hơn.',
      confirmLabel: 'Dùng AI viết lại',
      run: () => rewrite(r),
    });
  const editReason = ctx.superseded
    ? 'Đang xem phiên bản kế hoạch tổ cũ'
    : !canEdit
      ? 'Chỉ giáo viên chủ nhiệm của lớp được chỉnh sửa'
      : null;
  const saveReason =
    editReason || dateIssue || (saver.saving ? 'Đang lưu' : !saver.unsaved && !saver.error ? 'Không có thay đổi cần lưu' : null);
  const resize = (branch, field, value) => {
    try {
      const next = resizeBranch(
        draft,
        yearPlan,
        branch.key,
        field === 'startDate' ? value : branch.startDate,
        field === 'endDate' ? value : branch.endDate,
      );
      flagEdit(() => next);
    } catch (error) {
      toast(error.message, 'warn');
    }
  };
  const setUnmappedDate = (row, field, value) => {
    const next = { ...pendingDates[row.start], [field]: value };
    setPendingDates((dates) => ({ ...dates, [row.start]: next }));
    if (!next.startDate || !next.endDate) return;
    const key = crypto.randomUUID();
    try {
      // Giữ tên đã gõ cho tuần này khi chọn/đổi ngày (Tiền 11/11/2026: đổi ngày không làm mất tên nhánh)
      const branch = { key, themeId: row.theme.id, sourceTemplateId: null, name: draft.names?.[row.start] || '', ...next, weekNotes: {} };
      const mapped = resizeBranch({ ...draft, branches: [...draft.branches, branch] }, yearPlan, key, next.startDate, next.endDate);
      const issue = calendarDurationIssue(mapped, yearPlan);
      if (issue) return toast(issue, 'warn');
      flagEdit(() => mapped);
      setPendingDates((dates) => {
        const { [row.start]: _, ...rest } = dates;
        return rest;
      });
    } catch (error) {
      toast(error.message, 'warn');
    }
  };
  const importFile = (result, context) => {
    if (
      !canEdit ||
      aiBusy ||
      saver.saving ||
      context.classId !== classId ||
      context.yearPlanId !== yearPlan.id ||
      draft.yearPlanId !== yearPlan.id
    ) {
      toast('Lớp, kế hoạch năm hoặc quyền sửa đã thay đổi. Hãy mở lại bản xem trước.', 'warn');
      return false;
    }
    const next = applyBranchFile(draft, pending, result);
    setDraft(next.draft);
    setPending(next.pending);
    setDirty(true);
    return true;
  };
  // Ô tháng và ô chủ đề gộp các dòng liên tiếp cùng tháng / cùng chủ đề như bảng của trường
  const spanFrom = (i, same) => {
    let n = 1;
    while (i + n < displayRows.length && same(displayRows[i + n], displayRows[i])) n += 1;
    return n;
  };
  const sameMonth = (a, b) => monthOf(a.start) === monthOf(b.start);
  const sameTheme = (a, b) => a.theme.id === b.theme.id;

  return (
    <div className={`page ga-page ga-class-editor${editing ? ' is-editing' : ' is-viewing'}`}>
      <div className="ga-sticky-head">
        <PageHead
          crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Dự kiến chủ đề - chủ đề nhánh' }, { label: cls.name }]}
          title={`Dự kiến chủ đề - chủ đề nhánh ${cls.name}`}
        />
        <ClassFilterBar
          classes={classes}
          classId={classId}
          canPick={ctx.canPickClass}
          onPick={(id) => {
            setEditing(false);
            guard.leave(`/education/branches/${id}`);
          }}
        >
          <FilterSelect
            label="Học kỳ"
            value={selectedPackage ? semesterNo : ''}
            onChange={setSemesterNo}
            options={[
              { value: '', label: 'Cả năm' },
              ...choices.map((c) => ({ value: String(c.semesterNo), label: `Học kỳ ${c.semesterNo}` })),
            ]}
          />
          {!editable && (
            <FilterSelect
              label="Kiểu hiển thị"
              value={view}
              onChange={setView}
              options={[
                { value: 'list', label: 'Danh sách' },
                { value: 'grid', label: 'Bảng' },
              ]}
            />
          )}
        </ClassFilterBar>
        {/* Thanh thao tác như màn Kế hoạch năm học: nút cỡ nhỏ viền xanh, nhóm lưu/gửi/xuất bên phải (Tiền 04/11) */}
        <div className="ga-year-toolbar" role="group" aria-label="Thao tác chủ đề nhánh">
          <div className="ga-year-toolbar__group">
            <span className="ga-year-toolbar__title">{cls.name}</span>
            {editable && (
              <button
                type="button"
                className="btn btn--sm btn--outline-primary"
                disabled={aiBusy || saver.saving}
                onClick={() => setImportContext({ classId, yearPlanId: yearPlan.id, draftCalendar: draft })}
              >
                <Download size={16} aria-hidden /> Nhập file
              </button>
            )}
          </div>
          <div className="ga-year-toolbar__group ga-year-toolbar__group--end">
            {editing && (
              <>
                <p className="muted text-sm ga-year-save-status" aria-live="polite">
                  {saver.label}
                </p>
                <VersionHistory
                  drafts={saver.drafts}
                  saved={saver.cleanDoc()}
                  current={payload}
                  unsaved={saver.unsaved}
                  linesOf={docLines}
                  onUse={(entry) => (entry ? saver.restoreDraft(entry) : saver.restoreSaved())}
                />
              </>
            )}
            {/* Chỉnh sửa / Hủy cùng một chỗ, Lưu đứng sau (Tiền 13/11/2026) */}
            {editable ? (
              <button type="button" className="btn btn--sm btn--outline-primary" disabled={aiBusy || saver.saving} onClick={cancelEdit}>
                <X size={16} aria-hidden /> Hủy
              </button>
            ) : (
              !editing &&
              canEdit && (
                <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setEditing(true)}>
                  <Pencil size={16} aria-hidden /> Chỉnh sửa
                </button>
              )
            )}
            {editing && (
              <>
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  onClick={saver.save}
                  disabled={!!saveReason}
                  title={saveReason || 'Lưu (Ctrl+S)'}
                  aria-description={saveReason || undefined}
                >
                  <Save size={16} aria-hidden /> Lưu
                </button>
              </>
            )}
            {/* Xuất / in ở mọi bước; đã duyệt thì Phó HT in ra ký, giáo viên in để dùng hằng ngày */}
            <button type="button" className="btn btn--sm btn--outline-primary" onClick={() => setPreview(branchFile(printArgs))}>
              <FileDown size={16} aria-hidden /> Xuất file
            </button>
            {preview && <DocPreviewModal file={preview} onClose={() => setPreview(null)} />}
          </div>
        </div>
      </div>
      {canEdit && <SupersededNote doc={saved || (ctx.superseded ? { superseded: true, yearPlanVersion: versionOf(yearPlan) } : null)} />}
      {!saved && version.prevDoc && !dirty && (
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
        onDrop={(f) => flagEdit((d) => dropReference('branch', d, f))}
      />
      {canEdit && semesterConfigMissing && (
        // Spec 003 US1/AC7: chưa có ngày học kỳ thì gói học kỳ không có hạn
        <Notice>Năm học chưa cấu hình học kỳ.</Notice>
      )}
      {!packages.length && ['DRAFT', 'REJECTED'].includes(status) && (
        <div className="mb-16">
          <RejectedNotice status={status} history={saved?.history} />
        </div>
      )}
      {editable && dateIssue && <Notice>{dateIssue}</Notice>}
      <Card
        title="Dự kiến chủ đề - chủ đề nhánh"
        bodyClass={null}
        actions={
          editable ? (
            <span className="row row--wrap gap-2">
              {pendingWeeks.length > 0 ? (
                <>
                  <button type="button" className="btn btn--sm" onClick={confirmRejectAll}>
                    <X size={16} aria-hidden /> Bỏ tất cả
                  </button>
                  <button type="button" className="btn btn--success btn--sm" onClick={() => setPending({})}>
                    <Check size={16} aria-hidden /> Giữ tất cả ({pendingWeeks.length})
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn--outline-primary btn--sm"
                    disabled={aiBusy || !empty}
                    onClick={() => confirmSuggest(null)}
                  >
                    <Lightbulb size={16} aria-hidden /> AI gợi ý cả năm
                  </button>
                  <button
                    type="button"
                    className="btn btn--outline-primary btn--sm"
                    disabled={aiBusy || empty === weekCount}
                    onClick={confirmRewriteAll}
                  >
                    <Wand2 size={16} aria-hidden /> AI viết lại cả năm
                  </button>
                </>
              )}
            </span>
          ) : null
        }
      >
        <div className="card__body stack">
          {view === 'grid' && !editable ? (
            <BranchGridTable rows={teachingWeeks(yearPlan, draft).filter(inSemester)} names={draft.names} branches={draft.branches} />
          ) : (
            <div className="table-wrap">
              <table
                className={`table ga-plan-table ga-goal-table ga-branch-plan-table${editable ? '' : ' ga-branch-readonly'}`}
                onMouseDown={focusCell}
              >
                <colgroup>
                  <col className="ga-col-month" />
                  <col className="ga-goal-table__group" />
                  <col />
                  <col className="ga-branch-plan-table__weeks" />
                  <col />
                </colgroup>
                <thead>
                  <tr>
                    <th className={editable ? 'cell--fixed' : ''}>Tháng</th>
                    <th className={editable ? 'cell--fixed' : ''}>Chủ đề</th>
                    <th className={editable ? 'ga-th-editable' : ''}>Chủ đề nhánh</th>
                    <th className={editable ? 'ga-th-editable' : ''}>Tuần</th>
                    <th className={editable ? 'ga-th-editable' : ''}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((r, i) => {
                    const monthCell = (i === 0 || !sameMonth(displayRows[i - 1], r)) && (
                      <td className={editable ? 'cell--fixed' : ''} rowSpan={spanFrom(i, sameMonth)}>
                        <div className="ga-goal-table__pad nowrap">Tháng {monthOf(r.start)}</div>
                      </td>
                    );
                    const themeCell = (i === 0 || !sameTheme(displayRows[i - 1], r)) && (
                      <td className={editable ? 'cell--fixed' : ''} rowSpan={spanFrom(i, sameTheme)}>
                        <div className="ga-goal-table__pad stack">
                          <span className="fw-600">{r.theme.name}</span>
                          <span className="text-xs">
                            {ddmm(r.theme.start)} → {ddmm(r.theme.end)}
                          </span>
                          {version.unresolved.some((f) => f.ref === `theme:${r.theme.id}`) && (
                            <span className="field__error">Chủ đề đổi ở kế hoạch năm mới — kiểm tra tên nhánh</span>
                          )}
                          {editable && (
                            <span>
                              <button
                                type="button"
                                className="btn btn--outline-primary btn--sm"
                                disabled={aiBusy}
                                onClick={() => confirmSuggest(r.theme)}
                              >
                                <Lightbulb size={14} aria-hidden /> {aiTheme === r.theme.id ? 'Đang gợi ý…' : 'AI gợi ý'}
                              </button>
                            </span>
                          )}
                        </div>
                      </td>
                    );
                    const branch = r.type === 'week' && branchForWeek(r);
                    const firstBranchWeek = branch && branchWeeks(branch, yearPlan, draft)[0]?.start === r.start;
                    const schedule = draft.themeSchedules.find((item) => String(item.themeId) === String(r.theme.id));
                    const dateRange = branch || pendingDates[r.start] || {};
                    const takenDates = draft.branches
                      .filter((item) => item.key !== branch?.key && item.startDate)
                      .map((item) => ({ start: item.startDate, end: item.endDate, label: item.name || 'chủ đề nhánh khác' }));
                    if (r.type === 'break')
                      return (
                        <tr key={`b-${r.start}`}>
                          {monthCell}
                          {themeCell}
                          <td colSpan={3} className={editable ? 'cell--fixed' : ''}>
                            <div className="ga-goal-table__pad">
                              Nghỉ: {r.label || 'Đợt nghỉ'} ({ddmm(r.start)} → {ddmm(r.end)})
                            </div>
                          </td>
                        </tr>
                      );
                    return (
                      <tr key={r.start}>
                        {monthCell}
                        {themeCell}
                        <td className={editable ? (pending[r.start] ? 'ga-cell--ai' : 'ga-cell-editable') : undefined}>
                          <div className="ga-goal-line__text">
                            <Cell
                              editable={editable}
                              value={draft.names[r.start]}
                              label={`Chủ đề nhánh tuần ${r.no}`}
                              placeholder="Nhập tên chủ đề nhánh"
                              onChange={(v) => editName(r.start, v)}
                            />
                            {editable && branch && !pending[r.start] && draft.names[r.start]?.trim() && (
                              <button
                                type="button"
                                className="icon-btn"
                                title="AI viết lại cho hay hơn"
                                aria-label={`AI viết lại tên chủ đề nhánh tuần ${r.no}`}
                                disabled={aiBusy}
                                onClick={() => confirmRewrite(r)}
                              >
                                <Wand2 size={16} aria-hidden />
                              </button>
                            )}
                            {/* Tên do AI điền hoặc viết lại: giữ (✓) hoặc bỏ (✗) ngay cạnh ô */}
                            {editable && pending[r.start] && (
                              <>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Giữ gợi ý"
                                  aria-label={`Giữ gợi ý tuần ${r.no}`}
                                  onClick={() => settle(r.start)}
                                >
                                  <Check size={16} aria-hidden />
                                </button>
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Bỏ gợi ý"
                                  aria-label={`Bỏ gợi ý tuần ${r.no}`}
                                  onClick={() => rejectAi(r.start)}
                                >
                                  <X size={16} aria-hidden />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                        <td className={`ga-branch-plan-table__week-cell${editable ? ' ga-cell-editable' : ''}`}>
                          <div className="ga-goal-table__pad">
                            {editable && (firstBranchWeek || !branch) ? (
                              <div className="ga-branch-template-dates ga-branch-date-range ga-branch-week-dates">
                                <DatePickerCell
                                  compact
                                  clearable={false}
                                  label={`Từ ngày chủ đề nhánh tuần ${r.no}`}
                                  value={dateRange.startDate || ''}
                                  range={{ start: dateRange.startDate, end: dateRange.endDate }}
                                  taken={takenDates}
                                  openAt={schedule?.startDate}
                                  min={schedule?.startDate}
                                  max={schedule?.endDate}
                                  onChange={(value) =>
                                    branch ? resize(branch, 'startDate', value) : setUnmappedDate(r, 'startDate', value)
                                  }
                                />
                                <span aria-hidden="true">–</span>
                                <DatePickerCell
                                  compact
                                  clearable={false}
                                  label={`Đến ngày chủ đề nhánh tuần ${r.no}`}
                                  value={dateRange.endDate || ''}
                                  range={{ start: dateRange.startDate, end: dateRange.endDate }}
                                  taken={takenDates}
                                  openAt={dateRange.startDate || schedule?.startDate}
                                  min={dateRange.startDate || schedule?.startDate}
                                  max={schedule?.endDate}
                                  onChange={(value) => (branch ? resize(branch, 'endDate', value) : setUnmappedDate(r, 'endDate', value))}
                                />
                              </div>
                            ) : (
                              <span className="nowrap">
                                {branch ? fmtDate(firstBranchWeek ? branch.startDate : r.start) : 'dd/mm/yyyy'}
                                {' – '}
                                {branch ? fmtDate(firstBranchWeek ? branch.endDate : r.end) : 'dd/mm/yyyy'}
                              </span>
                            )}
                            {r.offDays?.some(Boolean) && <div className="text-xs text-warning">Nghỉ {offDaysText(r.offDays)}</div>}
                          </div>
                        </td>
                        <td className={editable && branch ? 'ga-cell-editable' : ''}>
                          {branch ? (
                            branchWeeks(branch, yearPlan, draft).map((week, _, weeks) => (
                              <div key={week.start}>
                                {weeks.length > 1 && <span className="ga-goal-table__pad text-xs muted">Tuần {week.no}</span>}
                                <Cell
                                  editable={editable}
                                  value={draft.notes?.[week.start]}
                                  label={`Ghi chú tuần ${week.no}`}
                                  onChange={(value) => set('notes', week.start, value)}
                                />
                              </div>
                            ))
                          ) : (
                            <Cell editable={false} value="" label="Ghi chú" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {displayRows.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <div className="ga-goal-table__pad muted">
                          {selectedPackage
                            ? 'Học kỳ này chưa có chủ đề nào có lịch.'
                            : 'Kế hoạch năm chưa có chủ đề nào có ngày bắt đầu và kết thúc.'}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
      {importContext && (
        <ImportBranchFileModal
          {...importContext}
          user={user}
          draft={draft}
          templateArgs={printArgs}
          onImport={importFile}
          onClose={() => setImportContext(null)}
        />
      )}
      <ConfirmationModal
        open={!!confirm}
        danger={!!confirm?.danger}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        onConfirm={() => {
          // Đóng hộp hỏi rồi mới chạy: lúc AI chạy chỉ còn lớp phủ AI, không chồng "Đang gửi…" của hộp xác nhận
          const job = confirm.run;
          setConfirm(null);
          job();
        }}
        onClose={() => setConfirm(null)}
      />
      {/* Ký, gửi, duyệt ngay cuối trang như trang mục tiêu năm; không mở hộp thoại */}
      {/* AI xong ⇒ tên AI điền mở trong modal để giữ/bỏ; đóng modal thì ✓/✗ cạnh từng ô vẫn còn (user chốt) */}
      <Modal
        open={showPending && editable && pendingWeeks.length > 0}
        onClose={() => setShowPending(false)}
        size="lg"
        title={`Tên chủ đề nhánh AI điền (${pendingWeeks.length})`}
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setShowPending(false)}>
              Đóng, xử lý sau
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setShowPending(false);
                confirmRejectAll();
              }}
            >
              <X size={16} aria-hidden /> Bỏ tất cả
            </button>
            <button type="button" className="btn btn--success" onClick={() => setPending({})}>
              <Check size={16} aria-hidden /> Giữ tất cả
            </button>
          </>
        }
      >
        <p className="muted text-sm mb-12">Bản nháp AI: bấm ✓ để giữ, ✗ để trả về tên cũ. Đã giữ vẫn sửa được trong bảng.</p>
        <ul className="ga-ai-review">
          {mappedWeeks
            .filter((r) => pending[r.start])
            .map((r) => (
              <li key={r.start} className="ga-ai-review__item">
                <div className="ga-ai-review__week">
                  <b>Tuần {r.no}</b> <span className="muted text-sm">· {r.theme.name}</span>
                </div>
                <div className="ga-ai-review__name">
                  {pending[r.start].prev && <del className="muted">{pending[r.start].prev}</del>}
                  <ins>{draft.names[r.start]}</ins>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  title="Giữ gợi ý"
                  aria-label={`Giữ gợi ý tuần ${r.no}`}
                  onClick={() => settle(r.start)}
                >
                  <Check size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Bỏ gợi ý"
                  aria-label={`Bỏ gợi ý tuần ${r.no}`}
                  onClick={() => rejectAi(r.start)}
                >
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
        </ul>
      </Modal>
      {aiBusy && (
        <AiWorkingOverlay text={aiTheme === 'rewrite' || rewriting ? 'Đang viết lại tên chủ đề nhánh…' : 'Đang gợi ý tên chủ đề nhánh…'} />
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

/** Bảng theo tháng và tuần; tuần của cùng chủ đề nhánh được gộp chung một ô. */
function BranchGridTable({ rows, names, branches }) {
  const { months } = branchGrid(rows, names, branches);
  if (!months.length) return <p className="muted">Kế hoạch năm chưa có chủ đề nào có ngày bắt đầu và kết thúc.</p>;
  return (
    <DocTable className="ga-plan-table ga-goal-table ga-branch-readonly ga-branch-grid-table">
      <thead>
        <tr>
          <th scope="col">Tháng</th>
          {Array.from({ length: 5 }, (_, i) => (
            <th key={i} scope="col">
              Tuần {i + 1}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {months.map(({ month, cells }) => (
          <tr key={month}>
            <th scope="row">{Number(month.slice(5))}</th>
            {cells.map(({ slot, span, week, end, name }) => (
              <td key={slot} colSpan={span}>
                {week && (
                  <div className="ga-goal-table__pad">
                    {span > 1 && <div className="fw-600">Tuần {Array.from({ length: span }, (_, i) => slot + i).join(' + ')}</div>}
                    <div className="text-xs text-primary">
                      {ddmm(week.start)} đến {ddmm(end)}
                    </div>
                    <div className="text-xs muted">{week.theme.name}</div>
                    {name || <span className="muted">Chưa đặt tên</span>}
                  </div>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </DocTable>
  );
}
