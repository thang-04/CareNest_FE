import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertOctagon,
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  History,
  RefreshCw,
  Save,
} from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useEvaluation, useEvaluations } from '@/hooks/assessment/useAssessment';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import {
  confirmEvaluation,
  markProgramCompletion,
  regenerateEvaluationDraft,
  saveEvaluationDraft,
} from '@/services/assessment/assessmentService';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { StatusPage } from '@/components/ui/StatusPage';
import { FormField } from '@/components/form/FormField';
import { AiWorkingOverlay } from '@/components/ui/AiWorkingOverlay';
import { Modal } from '@/components/ui/Modal';
import { useAiRun } from '@/hooks/useAiRun';
import { AiDraftTag, EvaluationStatusBadge } from '@/components/assessment/AssessmentBadges';
import { PeriodSummaryTable } from '@/components/assessment/PeriodSummaryTable';
import { YearEndSheetCard } from '@/components/assessment/YearEndSheetCard';
import { DailyDaysTable } from '@/components/assessment/DailyDaysTable';
import { Pagination, paginate } from '@/components/ui/Pagination';
import { EVAL_HISTORY_LABELS, EVAL_KIND, EVAL_STATUS, PERIOD_TYPE_LABELS } from '@/models/assessment/assessmentConstants';
import { formatDate, formatDateTime } from '@/utils/format';
import { evaluationPeriodLabel, periodLabel } from '@/utils/assessment/assessmentPeriods';
import { canConfirmEvaluation, canReviewEvaluation, canViewAiDraft, isClassTeacher } from '@/utils/assessment/assessmentPermissions';
import { ChildAvatar } from '@/components/ChildAvatar';
import { validateEvaluationContent, hasErrors } from '@/utils/assessment/assessmentValidation';

const MSG30 = 'Trợ lý AI hiện không khả dụng. Bạn có thể tiếp tục viết đánh giá thủ công.';

/** Shared body of #56 Periodic Evaluation Detail and #59 Year-end Evaluation Detail (UC 4.5, 4.6). */
export function EvaluationReviewView({ kind, id }) {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { detail, loading, error, reload } = useEvaluation(kind, id, { live: false });
  const [content, setContent] = useState('');
  // Bản trên hệ thống mà ô nhập đang dựa vào; khác null mới so được "đã sửa" (không hỏi lưu khi vừa mở màn)
  const [loadedFrom, setLoadedFrom] = useState(null);
  const [contentError, setContentError] = useState('');
  const [programError, setProgramError] = useState('');
  const [busy, setBusy] = useState('');
  const { run: runAi } = useAiRun();
  const [fresh, setFresh] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dayPage, setDayPage] = useState(1);
  const yearEnd = kind === EVAL_KIND.YEAR_END;
  const base = `/assessment/${kind}`;

  const ev = detail?.evaluation;
  const savedContent = ev ? ev.finalContent || ev.aiDraft?.content || '' : '';
  // Nạp lại ô nhập chỉ khi sang đánh giá khác hoặc nội dung đã lưu đổi (tải lại sau khi đánh dấu hoàn thành chương
  // trình không xóa phần cô đang gõ)
  const evId = ev?.id;
  // Cùng một đánh giá mà cô đang gõ dở (vd. bấm "Tạo lại bản nháp" khi chưa lưu lần nào): giữ chữ của cô, bản nháp mới
  // chỉ vào ô qua "Dùng bản nháp này"
  const typed = useRef({ evId: null, content: '', loadedFrom: null });
  typed.current.content = content;
  typed.current.loadedFrom = loadedFrom;
  useEffect(() => {
    if (!evId) return;
    const t = typed.current;
    const dirty = t.evId === evId && t.loadedFrom !== null && t.content !== t.loadedFrom;
    t.evId = evId;
    if (!dirty) setContent(savedContent);
    setLoadedFrom(savedContent);
  }, [evId, savedContent]);

  // Trẻ cùng lớp, cùng kỳ (xếp theo tên) để chuyển ‹ › và mở trẻ chưa xác nhận tiếp theo
  const { evaluations } = useEvaluations(kind, ev ? { classId: ev.classId, schoolYear: ev.schoolYearId || undefined } : null, {
    enabled: !!ev,
  });
  const siblings = useMemo(
    () =>
      ev
        ? evaluations
            .filter((e) => e.periodType === ev.periodType && e.periodStart === ev.periodStart)
            .sort((a, b) => a.childName.localeCompare(b.childName, 'vi'))
        : [],
    [evaluations, ev],
  );
  const at = siblings.findIndex((e) => String(e.id) === String(ev?.id));
  const prev = at > 0 ? siblings[at - 1] : null;
  const next = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : null;
  const nextPending =
    at >= 0 ? [...siblings.slice(at + 1), ...siblings.slice(0, at)].find((e) => e.status !== EVAL_STATUS.CONFIRMED) : null;
  const linkOf = (e) => `${base}/${e.id}`;

  // Sửa nội dung chưa lưu mà rời màn / sang trẻ khác: hỏi trước
  const saveRef = useRef(null);
  // Phiếu cuối năm (OBS-28): lưu phiếu trước khi xác nhận, hỏi khi rời màn còn sửa chưa lưu
  const sheetRef = useRef(null);
  const editing = !!ev && ev.status !== EVAL_STATUS.CONFIRMED && loadedFrom === savedContent && content !== savedContent;
  const [sheetEdited, setSheetEdited] = useState(false);
  const sheetDirty = () => !!sheetRef.current?.dirty;
  const guard = useLeaveGuard({
    when: editing || sheetEdited,
    onSave: async () => {
      if (sheetDirty() && !(await sheetRef.current.save())) return false;
      return editing ? (saveRef.current?.() ?? false) : true;
    },
  });

  if (loading) return <LoadingState />;
  if (error) {
    if (error.status === 403 || error.status === 404)
      return (
        <div className="card">
          <StatusPage
            bare
            kind={String(error.status)}
            title="Không xem được đánh giá"
            description="Đánh giá không tồn tại hoặc nằm ngoài phạm vi của bạn."
          />
        </div>
      );
    return <ErrorState error={error} onRetry={reload} />;
  }
  if (!detail) return null;

  const canReview = canReviewEvaluation(ev, detail.cls, user);
  const canConfirm = canConfirmEvaluation(ev, detail.cls, user);
  const showDraft = canViewAiDraft(ev, detail.cls, user);
  const confirmed = ev.status === EVAL_STATUS.CONFIRMED;
  const label = evaluationPeriodLabel(ev);
  // BE gửi kèm tên người xử lý; mock tra danh mục người dùng
  const name = (uid, shown) => shown || md.userById(uid)?.fullName || 'Hệ thống';

  const check = () => {
    const errors = validateEvaluationContent(content);
    setContentError(errors.content || '');
    return !hasErrors(errors);
  };
  // Lớp 5–6 tuổi: đánh giá cuối năm phải chọn Hoàn thành / Chưa hoàn thành chương trình trước khi xác nhận
  const checkProgram = () => {
    const missing = ev.programApplicable && ev.programCompleted == null;
    setProgramError(missing ? 'Chọn Hoàn thành hoặc Chưa hoàn thành chương trình cho trẻ.' : '');
    return !missing;
  };
  const markProgram = async (completed) => {
    setProgramError('');
    setBusy('program');
    try {
      await markProgramCompletion(ev.id, completed, user);
      await reload({ silent: true });
    } catch (err) {
      setProgramError(err.details?.programCompleted || err.message || 'Chưa lưu được.');
    } finally {
      setBusy('');
    }
  };

  const run = async (key, fn, success) => {
    setBusy(key);
    try {
      const res = await fn();
      if (success) toast.success(success(res));
      await reload({ silent: true });
      return res;
    } catch (err) {
      toast.error(err, 'Không thực hiện được');
      // Lỗi nội dung từ BE (7340–7343) hiện đỏ dưới ô nhập
      if (err.details?.content) setContentError(err.details.content);
      if (err.details?.programCompleted) setProgramError(err.details.programCompleted);
      if (err.status === 409) reload({ silent: true });
      return null;
    } finally {
      setBusy('');
    }
  };

  const save = () =>
    check() &&
    run(
      'save',
      () => saveEvaluationDraft(kind, ev.id, content, user),
      () => 'Đã lưu chỉnh sửa. Đánh giá vẫn chờ bạn xác nhận.',
    );
  saveRef.current = async () => {
    if (!check()) return false;
    let ok = false;
    await run('save', async () => {
      const res = await saveEvaluationDraft(kind, ev.id, content, user);
      ok = true;
      return res;
    });
    return ok;
  };

  const redraft = async () => {
    setBusy('redraft');
    let res = null;
    try {
      res = await runAi(() => regenerateEvaluationDraft(kind, ev.id, user));
      if (res.status === EVAL_STATUS.AI_FAILED) toast.warning(res.aiError || MSG30, 'AI chưa tạo được bản nháp');
      await reload({ silent: true });
    } catch (err) {
      toast.error(err.message || MSG30, 'AI chưa tạo được bản nháp');
    } finally {
      setBusy('');
    }
    // Mở modal sau khi lớp phủ tắt (trang tải lại xong) để lớp phủ không đè lên modal
    if (res && res.status !== EVAL_STATUS.AI_FAILED) setFresh(res.aiDraft);
  };

  const doConfirm = async () => {
    // Phiếu cuối năm còn sửa chưa lưu: lưu trước để xác nhận chốt đúng phiếu cô thấy
    if (sheetDirty() && !(await sheetRef.current.save())) {
      setConfirmOpen(false);
      return null;
    }
    const res = await run(
      'confirm',
      () => confirmEvaluation(kind, ev.id, content, user),
      () => 'Đánh giá đã được xác nhận thành công.',
    );
    setConfirmOpen(false);
    // Xác nhận xong thì mở luôn trẻ chưa xác nhận tiếp theo cùng lớp, cùng kỳ
    if (res && nextPending) guard.leaveNow(linkOf(nextPending));
    return res;
  };

  return (
    <>
      <div className={yearEnd ? 'card dg-year-review-head' : 'page__head'}>
        <div className="dg-eval-head">
          <ChildAvatar child={detail.child || { fullName: ev.childName }} size="lg" />
          <div>
            <h1 className={yearEnd ? 'sr-only' : 'page__title'}>
              Đánh giá {PERIOD_TYPE_LABELS[ev.periodType].toLowerCase()} – {ev.childName}
            </h1>
            {/* Tiêu đề h1 chỉ cho trình đọc màn hình: hiện rõ họ tên, ngày sinh để GV biết đang đánh giá bé nào */}
            <div className="dg-eval-name">
              {detail.child?.fullName || ev.childName}
              {yearEnd && <EvaluationStatusBadge status={ev.status} />}
              {!yearEnd && detail.child?.dateOfBirth && (
                <span className="muted text-sm"> · Sinh ngày {formatDate(detail.child.dateOfBirth)}</span>
              )}
            </div>
            <div className="dg-eval-meta">
              {!yearEnd && <EvaluationStatusBadge status={ev.status} />}
              {yearEnd && detail.child?.dateOfBirth && <span>Sinh ngày {formatDate(detail.child.dateOfBirth)}</span>}
              <span>{ev.className}</span>
              <span>{label}</span>
              {ev.themeName && <span>Chủ đề: {ev.themeName}</span>}
              <span>Có mặt {detail.summary.presentDays} ngày</span>
              {!yearEnd && <span>Đánh giá hằng ngày {detail.summary.assessedDays} ngày</span>}
              {!yearEnd && confirmed && (
                <span>
                  Xác nhận bởi {name(ev.confirmedBy, ev.confirmedByName)} · {formatDateTime(ev.confirmedAt)}
                </span>
              )}
            </div>
            {yearEnd && confirmed && (
              <div className="dg-eval-meta mt-8">
                <span>
                  Xác nhận bởi {name(ev.confirmedBy, ev.confirmedByName)} · {formatDateTime(ev.confirmedAt)}
                </span>
                {!detail.cls?.teaches && <span className="chip">Chỉ xem</span>}
              </div>
            )}
          </div>
        </div>
        {yearEnd && confirmed && isClassTeacher(detail.cls, user) && (
          <Link className="btn btn--outline-primary" to={`/assessment/rewards/${ev.classId}`}>
            <Award size={16} /> Đề xuất khen thưởng
          </Link>
        )}
      </div>

      {!yearEnd && confirmed && !detail.cls?.teaches && (
        <div className="alert alert--info mt-16">Đánh giá đã xác nhận · Chỉ xem lịch sử của trẻ, không chỉnh sửa nội dung.</div>
      )}

      {yearEnd && (
        <YearEndSheetCard
          // Xác nhận (đổi trạng thái) ⇒ tải lại phiếu: phiếu chuyển chỉ xem, có ngày ký trên bản in
          key={`${ev.id}-${ev.status}`}
          evaluation={ev}
          child={detail.child}
          comment={canReview ? content : ev.finalContent}
          sheetRef={sheetRef}
          onDirtyChange={setSheetEdited}
        />
      )}

      {ev.status === EVAL_STATUS.AI_FAILED && canReview && (
        <div className="alert alert--danger mt-16">
          <AlertOctagon size={20} />
          <div className="flex-1">
            <div className="fw-600">{MSG30}</div>
            <div className="mt-8 text-sm">{ev.aiError}</div>
          </div>
          <button className="btn" onClick={redraft} disabled={!!busy}>
            <RefreshCw size={16} /> Yêu cầu tạo lại bản nháp
          </button>
        </div>
      )}

      {canReview ? (
        <div className={yearEnd ? 'stack mt-16' : 'split-2 mt-16'}>
          <details className="card">
            <summary className="card__header">
              <span className="card__title">Bản nháp AI làm căn cứ</span>
              <AiDraftTag />
            </summary>
            <div className="card__body">
              {ev.aiDraft ? (
                <>
                  <div className="dg-ai-box text-sm">{ev.aiDraft.content}</div>
                  <div className="muted text-xs mt-8">
                    {yearEnd
                      ? `Tổng hợp từ ${detail.monthlyEvaluations.length} đánh giá tháng đã xác nhận`
                      : `Tổng hợp từ ${detail.summary.assessedDays} ngày đánh giá hằng ngày${
                          detail.monthlyEvaluations?.length ? ` và ${detail.monthlyEvaluations.length} đánh giá tháng` : ''
                        }`}{' '}
                    · tạo lúc {formatDateTime(ev.aiDraft.generatedAt)}
                  </div>
                  <div className="row row--wrap gap-2 mt-12">
                    <button
                      className="btn btn--sm"
                      onClick={() => setContent(ev.aiDraft.content)}
                      disabled={!!busy || content === ev.aiDraft.content}
                    >
                      <Copy size={14} /> Dùng bản nháp này
                    </button>
                    <button className="btn btn--sm" onClick={redraft} disabled={!!busy}>
                      <RefreshCw size={14} /> Tạo lại bản nháp
                    </button>
                    <Link className="btn btn--sm btn--ghost" to={`${base}/${ev.id}/ai-draft`}>
                      Dữ liệu AI đã dùng
                    </Link>
                  </div>
                </>
              ) : (
                <div className="muted">Chưa có bản nháp AI. Cô tự viết đánh giá ở khung bên cạnh.</div>
              )}
            </div>
          </details>
          <div className="card">
            <div className="card__header">
              <div className="card__title">Đánh giá chính thức</div>
            </div>
            <div className="card__body">
              <FormField
                label="Nội dung đánh giá"
                required
                error={contentError}
                hint="Sửa, bổ sung theo quan sát thực tế. Không dùng thuật ngữ chẩn đoán."
              >
                <textarea
                  className="textarea dg-editor"
                  rows={10}
                  value={content}
                  maxLength={3000}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setContentError('');
                  }}
                  onBlur={() => content && check()}
                />
              </FormField>
              <div className="muted text-xs dg-right">{content.length}/3000</div>
              {ev.programApplicable && (
                <FormField label="Hoàn thành chương trình GDMN" required error={programError}>
                  <div className="row gap-4" role="radiogroup" aria-label="Hoàn thành chương trình GDMN">
                    {[
                      [true, 'Hoàn thành'],
                      [false, 'Chưa hoàn thành'],
                    ].map(([value, text]) => (
                      <label key={text} className="radio">
                        <input
                          type="radio"
                          name={`program-${ev.id}`}
                          checked={ev.programCompleted === value}
                          disabled={!!busy}
                          onChange={() => markProgram(value)}
                        />
                        {text}
                      </label>
                    ))}
                  </div>
                </FormField>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="card mt-16">
          <div className="card__header">
            <div className="card__title">
              <CheckCircle2 size={18} className="text-success" /> Đánh giá chính thức
            </div>
          </div>
          <div className="card__body">
            {confirmed ? (
              <>
                <div className="dg-final">{ev.finalContent}</div>
                {ev.programApplicable && (
                  <div className="mt-12">
                    Chương trình GDMN: <b>{ev.programCompleted ? 'Hoàn thành' : 'Chưa hoàn thành'}</b>
                  </div>
                )}
                <div className="muted text-sm mt-12">
                  Xác nhận bởi {name(ev.confirmedBy, ev.confirmedByName)} · {formatDateTime(ev.confirmedAt)}
                </div>
              </>
            ) : (
              <div className="muted">Đánh giá chưa được giáo viên xác nhận.</div>
            )}
          </div>
        </div>
      )}

      {yearEnd ? (
        detail.summary.structured?.observedDays ? (
          <PeriodSummaryTable data={detail.summary.structured} />
        ) : (
          <section className="card mt-16">
            <div className="card__header">
              <h2 className="card__title">Số liệu từ đánh giá hằng ngày</h2>
            </div>
            <div className="card__body muted">Chưa có ghi nhận đánh giá hằng ngày trong năm học.</div>
          </section>
        )
      ) : (
        <details className="card mt-16">
          <summary className="card__header">Xem dữ liệu làm căn cứ</summary>
          <PeriodSummaryTable data={detail.summary.structured} />
        </details>
      )}

      {/* Nhận xét tháng trong chi tiết học kỳ cũ. */}
      {kind === EVAL_KIND.SEMESTER && (
        <div className="card mt-16">
          <div className="card__header">
            <div className="card__title">Đánh giá tháng đã xác nhận trong học kỳ</div>
          </div>
          <div className="card__body">
            {detail.monthlyEvaluations.length ? (
              <div className="stack">
                {detail.monthlyEvaluations.map((m) => (
                  <div key={m.id}>
                    <div className="fw-600">{periodLabel(m.periodType, m.periodStart, m.periodEnd)}</div>
                    <div className="dg-final text-sm text-2">{m.finalContent}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">Chưa có đánh giá tháng nào được xác nhận trong kỳ này.</div>
            )}
          </div>
        </div>
      )}

      {!yearEnd && (
        <div className="card mt-16">
          <div className="card__header">
            <div className="card__title">Đánh giá hằng ngày trong kỳ</div>
            <span className="muted text-sm">Xanh: đạt · Đỏ: chưa đạt</span>
          </div>
          <div className="card__body">
            {/* 10 ngày / trang như bảng này ở Hồ sơ phát triển */}
            <DailyDaysTable
              days={paginate(detail.days, Math.min(dayPage, Math.max(1, Math.ceil(detail.days.length / 10))), 10)}
              mealSessions={detail.mealSessions}
              classId={ev.classId}
              linkDays={canReview}
            />
            {detail.days.length > 10 && (
              <Pagination
                page={Math.min(dayPage, Math.ceil(detail.days.length / 10))}
                total={detail.days.length}
                pageSize={10}
                onChange={setDayPage}
                unit="ngày"
              />
            )}
          </div>
        </div>
      )}

      {showDraft && (
        <div className="card mt-16">
          <div className="card__header">
            <div className="card__title">
              <History size={18} /> Lịch sử xử lý
            </div>
          </div>
          <div className="card__body">
            <ul className="history-list">
              {[...ev.history].reverse().map((h) => (
                <li key={h.id}>
                  <div className="history-list__dot" />
                  <div>
                    <div>
                      <b>{EVAL_HISTORY_LABELS[h.action] || h.action}</b> · {name(h.userId, h.userName)}
                    </div>
                    {h.note && <div className="text-2">“{h.note}”</div>}
                    <div className="muted text-xs">{formatDateTime(h.at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="page-actions">
        <button className="btn" onClick={() => guard.leave(base)}>
          <ArrowLeft size={16} /> Về danh sách
        </button>
        {siblings.length > 1 && at >= 0 && (
          <div className="row gap-2" aria-label="Chuyển trẻ cùng lớp, cùng kỳ">
            <button className="btn" onClick={() => prev && guard.leave(linkOf(prev))} disabled={!prev} title={prev?.childName}>
              <ChevronLeft size={16} /> Trẻ trước
            </button>
            <span className="muted text-sm">
              {at + 1}/{siblings.length}
            </span>
            <button className="btn" onClick={() => next && guard.leave(linkOf(next))} disabled={!next} title={next?.childName}>
              Trẻ sau <ChevronRight size={16} />
            </button>
          </div>
        )}
        {(canReview || canConfirm) && (
          <div className="row gap-2">
            {canReview && (
              <button className="btn" onClick={save} disabled={!!busy}>
                {busy === 'save' ? <Spinner small /> : <Save size={16} />} Lưu chỉnh sửa
              </button>
            )}
            {canConfirm && (
              <button
                className="btn btn--primary"
                onClick={() => [check(), checkProgram()].every(Boolean) && setConfirmOpen(true)}
                disabled={!!busy}
              >
                <CheckCircle2 size={16} /> {yearEnd ? 'Xác nhận đánh giá' : 'Xác nhận và công bố'}
              </button>
            )}
          </div>
        )}
      </div>

      <ConfirmationModal
        open={confirmOpen}
        title={yearEnd ? 'Xác nhận đánh giá cuối năm?' : 'Xác nhận và công bố đánh giá?'}
        message={
          yearEnd
            ? 'Đánh giá sẽ trở thành chính thức, dùng cho Ban giám hiệu và đề xuất khen thưởng. Sau khi xác nhận không sửa được.'
            : 'Đánh giá sẽ trở thành chính thức và được công bố cho phụ huynh, Phó hiệu trưởng và Hiệu trưởng. Sau khi xác nhận không sửa được.'
        }
        confirmLabel={nextPending ? 'Xác nhận, trẻ tiếp' : yearEnd ? 'Xác nhận đánh giá' : 'Xác nhận và công bố'}
        onConfirm={doConfirm}
        onClose={() => setConfirmOpen(false)}
      />
      {/* AI xong ⇒ bản nháp mới mở trong modal; đóng thì vẫn dùng được ở khung "Bản nháp AI" (user chốt) */}
      <Modal
        open={!!fresh}
        onClose={() => setFresh(null)}
        size="lg"
        title="Bản nháp AI mới"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setFresh(null)}>
              Đóng
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setContent(fresh.content);
                setFresh(null);
              }}
            >
              <Copy size={16} /> Dùng bản nháp này
            </button>
          </>
        }
      >
        <div className="row gap-2 mb-12">
          <AiDraftTag />
          {fresh && <span className="muted text-sm">Tạo lúc {formatDateTime(fresh.generatedAt)}</span>}
        </div>
        <div className="dg-ai-box text-sm">{fresh?.content}</div>
      </Modal>
      {busy === 'redraft' && <AiWorkingOverlay text="Đang soạn bản nháp đánh giá…" />}
      <LeaveConfirmModal {...guard.modal} canSave message="Nội dung đánh giá có chỉnh sửa chưa lưu." />
    </>
  );
}
