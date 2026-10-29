import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { Check, FileDown, Lightbulb, Printer, Save, Wand2, X } from '@/components/ui/icons';
import { exportBranchFile } from '@/utils/education-plan/classPlanDoc';
import { rewriteBranchName, suggestBranchNames } from '@/services/education-plan/educationPlanService';
import { Card, DraftRecoveryNotice, EduStatusBadge, PageHead } from '@/components/education-plan/eduUi';
import { Cell, docReview, focusCell, useClassPlanContext } from '@/components/education-plan/planUi';
import { RejectedNotice, ReviewActions, ReviewHistory } from '@/components/education-plan/reviewUi';
import { LoadingState } from '@/components/ui/States';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { Modal } from '@/components/ui/Modal';
import { useAiRun } from '@/hooks/useAiRun';
import { StatusPage } from '@/components/ui/StatusPage';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useEducationPlan } from '@/hooks/education-plan/useEducationPlan';
import { useManualSave } from '@/hooks/education-plan/useManualSave';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { EDU_STATUS } from '@/models/education-plan/educationPlanConstants';
import { ddmm, emptyBranchPlan, isEditableStatus, monthOf, yearWeeks } from '@/models/education-plan/classPlan';
import { SupersededNote, VersionCopyOffer, VersionFlagsPanel } from '@/components/education-plan/VersionWidgets';
import { useDocVersion } from '@/hooks/education-plan/useDocVersion';
import { checkFlag, dropReference, versionOf } from '@/models/education-plan/planVersions.mjs';

/**
 * "Dự kiến chủ đề nhánh và thời gian thực hiện" theo mẫu MN Thái Dương.
 * Tháng | Chủ đề (gộp dòng) | Chủ đề nhánh (giáo viên gõ) | Tuần (đánh số cả năm, dòng nghỉ) | Ghi chú.
 * Mục "Chủ đề nhánh" trên sidebar, lập một lần cho cả năm; gửi duyệt và duyệt ở cuối trang, đã duyệt thì in ra ký tay.
 */
export default function BranchPlanPage() {
  const { classId } = useParams();
  // Đổi lớp thì dựng lại trang để bỏ bản sửa dở của lớp trước
  return <BranchPlanInner key={classId} classId={classId} />;
}

const POPUP_BLOCKED = 'Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi bấm lại.';
// Bản gửi đi khi lưu: ô AI chưa ✓ / ✗ vẫn lưu tên trước đó, chỉ lưu khi giáo viên đã giữ
const payloadOf = (draft, pending) =>
  draft && { ...draft, names: { ...draft.names, ...Object.fromEntries(Object.entries(pending).map(([w, p]) => [w, p.prev])) } };

/** Đường dẫn cũ /education/class/:classId/branches(/review). */
export function BranchPlanLegacyRedirect() {
  const { classId } = useParams();
  return <Navigate to={`/education/branches/${classId}`} replace />;
}

function BranchPlanInner({ classId }) {
  const { user, branchPlans, saveClassDoc, actOnClassDoc, toast, eduConfig } = useEducationPlan();
  const ctx = useClassPlanContext(classId);
  const { cls, classes, yearPlan, teachers, isClassTeacher } = ctx;
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
  const version = useDocVersion('branch', saved, ctx, branchPlans);
  const autoOk = isClassTeacher && !ctx.superseded && isEditableStatus(saved?.status || EDU_STATUS.DRAFT);
  const payload = payloadOf(draft, pending);
  const hasPending = Object.keys(pending).length > 0;
  // Lưu tay (nút Lưu, Ctrl+S); rời trang khi chưa lưu thì hỏi
  const saver = useManualSave({
    doc: payload,
    enabled: autoOk,
    save: (doc) => saveClassDoc('branch', doc),
    // Còn ô AI chờ ✓ / ✗ thì giữ bản đang sửa, không nạp lại từ bản đã lưu
    onSaved: (same) => same && !hasPending && setDirty(false),
    backup: { userId: user?.id, key: yearPlan && `branch:${classId}:${yearPlan.id}` },
    onRestore: (doc) => {
      setDraft(doc);
      setDirty(true);
    },
  });
  const guard = useLeaveGuard({ when: autoOk && saver.unsaved, onSave: saver.save });

  useEffect(() => {
    if (dirty) return;
    const doc = saved || (yearPlan ? emptyBranchPlan({ classId, yearPlanId: yearPlan.id }) : null);
    setDraft(doc);
    saver.markClean(doc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved?.id, saved?.status, saved?.history?.length, yearPlan?.id, classId]);

  if (ctx.loading) return <LoadingState />;
  if (!cls || !yearPlan) return <StatusPage kind="404" title="Không tìm thấy lớp hoặc kế hoạch năm của lớp chưa được ban hành" />;
  if (!draft) return <LoadingState />;

  const status = saved?.status || EDU_STATUS.DRAFT;
  const canEdit = autoOk;
  // Chép chủ đề nhánh của phiên bản trước sang phiên bản mới (BE:EDU-26)
  const copyOld = async () => {
    setCopying(true);
    const doc = await saveClassDoc('branch', version.copy());
    setCopying(false);
    if (doc) toast('Đã chép chủ đề nhánh cũ. Sửa các mục đỏ rồi gửi duyệt lại.');
  };
  const flagEdit = (fn) => {
    setDraft((d) => fn(d));
    setDirty(true);
  };
  const editable = canEdit;
  const rows = yearWeeks(yearPlan);
  const weekCount = rows.filter((r) => r.type === 'week').length;
  const empty = rows.filter((r) => r.type === 'week' && !draft.names[r.start]?.trim()).length;
  const set = (field, key, value) => {
    setDraft((d) => ({ ...d, [field]: { ...d[field], [key]: value } }));
    setDirty(true);
  };
  const settle = (week) =>
    setPending((p) => {
      const { [week]: _, ...rest } = p;
      return rest;
    });
  // Gợi ý các tuần còn trống: của một chủ đề, hoặc cả năm khi theme = null
  const askAi = async (theme) => {
    const weekRows = rows.filter((r) => r.type === 'week');
    const targets = weekRows.filter((r) => (!theme || r.theme.id === theme.id) && !draft.names[r.start]?.trim());
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
    set('names', week, value);
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
    const named = rows.filter((r) => r.type === 'week' && draft.names[r.start]?.trim());
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
  const printArgs = { doc: saved || draft, cls, yearPlan, teachers };
  // Hỏi trước khi chạy AI; kết quả là bản nháp để giáo viên giữ / bỏ
  const confirmSuggest = (theme) => {
    const n = rows.filter((r) => r.type === 'week' && (!theme || r.theme.id === theme.id) && !draft.names[r.start]?.trim()).length;
    if (!n) return toast(theme ? 'Các tuần của chủ đề này đã có tên chủ đề nhánh' : 'Cả năm đã có tên chủ đề nhánh');
    setConfirm({
      title: theme ? `AI gợi ý cho "${theme.name}"?` : 'AI gợi ý cả năm?',
      message: `AI sẽ đặt tên chủ đề nhánh cho ${n} tuần còn trống.`,
      confirmLabel: 'Dùng AI gợi ý',
      run: () => askAi(theme),
    });
  };
  const confirmRewriteAll = () => {
    const n = rows.filter((r) => r.type === 'week' && draft.names[r.start]?.trim()).length;
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
  // Chưa đủ điều kiện gửi: chỉ nhắc ở góc màn hình khi bấm, không mở hộp gửi
  const checkBeforeOpen = (action) => {
    if (action !== 'submit') return true;
    if (pendingWeeks.length) {
      toast(`Còn ${pendingWeeks.length} tên do AI điền chưa giữ hoặc bỏ. Bấm ✓ / ✗ hoặc "Giữ tất cả" trước khi gửi.`, 'warn');
      return false;
    }
    if (empty > 0) {
      toast(`Còn ${empty} tuần chưa đặt tên chủ đề nhánh. Đặt tên đủ các tuần rồi mới gửi duyệt.`, 'warn');
      return false;
    }
    return true;
  };
  const act = (action, note) => actOnClassDoc('branch', draft.id, { action, note });
  const review = docReview('branch', saved, ctx, user, eduConfig);
  // Ô tháng và ô chủ đề gộp các dòng liên tiếp cùng tháng / cùng chủ đề như bảng của trường
  const spanFrom = (i, same) => {
    let n = 1;
    while (i + n < rows.length && same(rows[i + n], rows[i])) n += 1;
    return n;
  };
  const sameMonth = (a, b) => monthOf(a.start) === monthOf(b.start);
  const sameTheme = (a, b) => a.theme.id === b.theme.id;

  return (
    <div className="page ga-page">
      <PageHead
        crumbs={[{ label: 'Kế hoạch giáo dục' }, { label: 'Chủ đề nhánh' }]}
        title={`Chủ đề nhánh ${cls.name}`}
        desc={<EduStatusBadge status={status} size="lg" />}
        actions={
          <>
            {/* Xuất / in ở mọi bước; đã duyệt thì Phó HT in ra ký, giáo viên in để dùng hằng ngày */}
            <button type="button" className="btn btn--ghost" onClick={() => exportBranchFile(printArgs, 'doc')}>
              <FileDown size={16} aria-hidden /> Xuất Word
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => exportBranchFile(printArgs, 'print') || toast(POPUP_BLOCKED, 'warn')}
            >
              <Printer size={16} aria-hidden /> In / Lưu PDF
            </button>
            {ctx.canPickClass && (
              <select
                className="select"
                aria-label="Chọn lớp"
                value={classId}
                onChange={(e) => guard.leave(`/education/branches/${e.target.value}`)}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
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
            <ReviewActions
              name="chủ đề nhánh"
              sendTo={review.sendTo}
              can={review.can}
              sendBlocked={
                saver.unsaved || saver.saving
                  ? 'Lưu trước khi gửi'
                  : // BE:EDU-26 — còn mục đỏ thì chưa gửi (BE cũng kiểm lại)
                    version.unresolved.length
                    ? `Còn ${version.unresolved.length} mục đổi theo kế hoạch năm mới cần sửa`
                    : null
              }
              beforeOpen={checkBeforeOpen}
              notes={{ submit: 'Chủ đề nhánh sẽ bị khóa cho tới khi được duyệt hoặc bị trả lại.' }}
              onAct={act}
            />
          </>
        }
      />
      <SupersededNote doc={saved || (ctx.superseded ? { superseded: true, yearPlanVersion: versionOf(yearPlan) } : null)} />
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
      {editable && saver.recovery && <DraftRecoveryNotice onRestore={saver.restoreBackup} onDismiss={saver.dismissRecovery} />}
      {status === EDU_STATUS.REJECTED && (
        <div className="mb-16">
          <RejectedNotice status={status} history={saved?.history} />
        </div>
      )}
      <Card
        title="Chủ đề nhánh"
        bodyClass={null}
        actions={
          editable && (
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
          )
        }
      >
        <div className="card__body stack">
          <div className="table-wrap">
            <table className="table ga-plan-table ga-goal-table" onMouseDown={focusCell}>
              <colgroup>
                <col className="ga-col-month" />
                <col className="ga-goal-table__group" />
                <col />
                <col className="ga-goal-table__group" />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th className="cell--fixed">Tháng</th>
                  <th className="cell--fixed">Chủ đề</th>
                  <th>Chủ đề nhánh</th>
                  <th className="cell--fixed">Tuần</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const monthCell = (i === 0 || !sameMonth(rows[i - 1], r)) && (
                    <td className="cell--fixed" rowSpan={spanFrom(i, sameMonth)}>
                      <div className="ga-goal-table__pad nowrap">Tháng {monthOf(r.start)}</div>
                    </td>
                  );
                  const themeCell = (i === 0 || !sameTheme(rows[i - 1], r)) && (
                    <td className="cell--fixed" rowSpan={spanFrom(i, sameTheme)}>
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
                  if (r.type === 'break')
                    return (
                      <tr key={`b-${r.start}`}>
                        {monthCell}
                        {themeCell}
                        <td colSpan={3} className="cell--fixed">
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
                      <td className={editable && pending[r.start] ? 'ga-cell--ai' : undefined}>
                        <div className="ga-goal-line__text">
                          <Cell
                            editable={editable}
                            value={draft.names[r.start]}
                            label={`Chủ đề nhánh tuần ${r.no}`}
                            placeholder="Nhập tên chủ đề nhánh"
                            onChange={(v) => editName(r.start, v)}
                          />
                          {editable && !pending[r.start] && draft.names[r.start]?.trim() && (
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
                      <td className="cell--fixed">
                        <div className="ga-goal-table__pad">
                          Tuần {r.no}: {ddmm(r.start)} → {ddmm(r.end)}
                        </div>
                      </td>
                      <td>
                        <Cell
                          editable={editable}
                          value={draft.notes?.[r.start]}
                          label={`Ghi chú tuần ${r.no}`}
                          onChange={(v) => set('notes', r.start, v)}
                        />
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="ga-goal-table__pad muted">Kế hoạch năm chưa có chủ đề nào có ngày bắt đầu và kết thúc.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
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
      <ReviewHistory items={saved?.history} />
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
          {rows
            .filter((r) => r.type === 'week' && pending[r.start])
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
