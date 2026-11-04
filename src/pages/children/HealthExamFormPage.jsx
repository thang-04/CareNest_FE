import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  Info,
  Lock,
  Pencil,
  Save,
  Send,
  ShieldAlert,
  Stethoscope,
} from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useHealthCheckClass, useHealthExam } from '@/hooks/children/useHealthChecks';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { RowMenu } from '@/components/ui/RowMenu';
import { Stepper } from '@/components/ui/Stepper';
import { EmptyState, LoadingState, Spinner } from '@/components/ui/States';
import { ChildAccessState, HEALTH_CHECK_ACCESS_TEXT } from '@/components/children/ChildAccessState';
import { ChildResultBadge, ConclusionCategoryBadge, FollowUpLevelBadge, PublishStatusBadge } from '@/components/children/ChildBadges';
import { ExamAdminStep } from '@/components/children/exam/ExamAdminStep';
import { ExamMeasureStep } from '@/components/children/exam/ExamMeasureStep';
import { ExamDevelopmentStep } from '@/components/children/exam/ExamDevelopmentStep';
import { ExamClinicalStep } from '@/components/children/exam/ExamClinicalStep';
import { ExamConclusionStep, ExamReviewCard, reviewPointTexts } from '@/components/children/exam/ExamConclusionStep';
import { ExamSummary } from '@/components/children/exam/ExamSummary';
import { previewHealthExamReview, saveHealthExam } from '@/services/children/healthCheckService';
import {
  CONCLUSION_ACTION,
  CONCLUSION_CATEGORY,
  CONCLUSION_MODE,
  EXAM_STATUS,
  EXAM_STEPS,
  FOLLOW_UP_FINDING,
  FOLLOW_UP_FINDING_LABELS,
  conclusionActionLabelOf,
  conclusionLabelOf,
  stepOfField,
} from '@/models/children/healthExamForm';
import { PARENT_VISIBLE_HEALTH_TEXT } from '@/models/children/childrenConstants';
import { CHILD_RESULT_STATUS } from '@/models/children/healthCheckConstants';
import { ageLabel } from '@/models/School';
import { formatDate, formatDateTime } from '@/utils/format';
import { hasErrors } from '@/utils/children/childrenValidation';
import { formatMeasurementChange } from '@/utils/children/childrenHelpers';
import { validateHealthExam } from '@/utils/children/healthExamValidation';
import { healthCheckCrumbs } from '@/utils/children/breadcrumbs';
import '@/styles/modules/children.css';

const STEP_LABELS = EXAM_STEPS.map((s) => s.label);
const clone = (x) => JSON.parse(JSON.stringify(x));

const setPath = (obj, path, value) => {
  const keys = path.split('.');
  const out = { ...obj };
  let cur = out;
  keys.slice(0, -1).forEach((k) => {
    cur[k] = { ...cur[k] };
    cur = cur[k];
  });
  cur[keys[keys.length - 1]] = value;
  return out;
};

// Đổi 1 ô thì bỏ lỗi của ô đó (và ô con); 3 ô kết luận dùng chung 1 lỗi.
const clearErrors = (errors, paths) => {
  const next = { ...errors };
  Object.keys(next).forEach((k) => {
    if (paths.some((p) => k === p || k.startsWith(`${p}.`))) delete next[k];
  });
  if (paths.some((p) => /^exam\.conclusion\.(normal|tbRisk|healthIssue)$/.test(p))) delete next['exam.conclusion.flags'];
  return next;
};

// Câu tóm tắt kết luận cho màn kết quả và hộp hỏi lại.
const conclusionSentence = (c) =>
  [
    `${conclusionLabelOf(c)}${c.issueText ? `: ${c.issueText}` : ''}`,
    conclusionActionLabelOf(c),
    c.adviceText ? `Lời dặn: ${c.adviceText}` : '',
  ]
    .map((s) => s.replace(/[.\s]+$/, ''))
    .filter(Boolean)
    .join('. ') + (c.doctorName ? ` — ${c.doctorName}` : '');

// Không có ngày khám: BE ghi (phiếu đã có giữ ngày, phiếu mới = hôm nay trong khoảng của đợt; user chốt 2026-11-04).
const formOf = (m) => ({
  heightCm: m.heightCm ?? '',
  weightKg: m.weightKg ?? '',
  headCircumferenceCm: m.headCircumferenceCm ?? '',
  exam: clone(m.exam),
  reason: '',
});

/** Kết luận của lần khám trước, để bác sĩ tham khảo (D18). */
function PreviousNotes({ view }) {
  const prev = view.previous;
  if (!prev?.conclusion) return null;
  return (
    <div className="alert alert--info mb-16">
      <FileCheck2 size={18} />
      <div className="tr-cell-stack">
        <span>
          Lần khám trước ({formatDate(prev.date)}
          {prev.campaignName ? `, ${prev.campaignName}` : ''}):{' '}
          {prev.conclusion.followUpFinding ? `${FOLLOW_UP_FINDING_LABELS[prev.conclusion.followUpFinding]}. ` : ''}
          {prev.conclusion.issueText || 'không ghi vấn đề'}. {conclusionActionLabelOf(prev.conclusion)}
          {prev.conclusion.adviceText ? `. Lời dặn: ${prev.conclusion.adviceText}` : ''}
        </span>
      </div>
    </div>
  );
}

export default function HealthExamFormPage() {
  const { campaignId, childId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { examView: view, setExamView, loading, error, reload } = useHealthExam(campaignId, childId);
  const classIdParam = params.get('classId') || view?.child.classId || '';
  const { roster } = useHealthCheckClass(view?.canEdit && classIdParam ? campaignId : null, classIdParam);
  const [form, setForm] = useState(null);
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reviewStale, setReviewStale] = useState(false);
  // Sửa phiếu đã kết luận không lưu nháp: điểm cần xem lại lấy theo dữ liệu đang nhập (BE tính, không lưu).
  const [previewPoints, setPreviewPoints] = useState(null);
  const [confirmConclude, setConfirmConclude] = useState(null);

  // Sang trẻ khác ("khám trẻ tiếp theo") thì bắt đầu phiếu mới.
  useEffect(() => {
    setForm(null);
    setErrors({});
    setEditing(false);
    setSaved(false);
    setReviewStale(false);
    setPreviewPoints(null);
    setConfirmConclude(null);
  }, [campaignId, childId]);

  useEffect(() => {
    if (!view || form) return;
    const m = view.measurement;
    if (!m && !view.draft) return;
    const { date: _date, ...draft } = view.draft || {};
    setForm(m ? formOf(m) : { ...clone(draft), reason: '' });
    const draftStep = m?.examStatus === EXAM_STATUS.DRAFT ? Math.min(m.exam.step || 0, 4) : 0;
    setStep(draftStep);
    setMaxReached(m?.examStatus === EXAM_STATUS.CONCLUDED ? 4 : draftStep);
  }, [view, form]);

  // Mở từ nút "Sửa phiếu khám" ở Sổ sức khỏe (?edit=1): phiếu đã kết luận vào thẳng chế độ sửa, chỉ một lần.
  const editRequested = params.get('edit') === '1';
  const [editApplied, setEditApplied] = useState(false);
  useEffect(() => {
    if (!editRequested || editApplied || !view?.canEdit || view.measurement?.examStatus !== EXAM_STATUS.CONCLUDED) return;
    setEditApplied(true);
    setEditing(true);
    setPreviewPoints(null);
    setStep(0);
    setMaxReached(4);
  }, [editRequested, editApplied, view]);

  // Giữ lớp và bộ lọc danh sách lớp (keyword, result…) khi qua lại giữa đợt khám và phiếu.
  const listParams = new URLSearchParams(params);
  listParams.delete('edit');
  if (classIdParam) listParams.set('classId', classIdParam);
  const listQuery = listParams.toString() ? `?${listParams}` : '';
  const campaignLink = `/children/health-checks/${campaignId}${listQuery}`;
  const child = view?.child;
  const crumbs = healthCheckCrumbs(
    view ? { label: view.campaign.name, to: campaignLink } : null,
    child ? `Phiếu khám: ${child.fullName}` : 'Phiếu khám',
  );

  if (loading)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <LoadingState />
      </div>
    );
  if (error || !view)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ChildAccessState error={error || { status: 404 }} onRetry={reload} text={HEALTH_CHECK_ACCESS_TEXT} />
      </div>
    );

  const m = view.measurement;
  const concluded = m?.examStatus === EXAM_STATUS.CONCLUDED;
  const editable = view.canEdit && (!concluded || editing);
  // Bước Kết luận khi khám theo lớp có 2 nút lưu kết luận: điện thoại gom Lưu nháp, Lưu kết luận vào nút "…"
  const saveMenu = step === 4 && !concluded && !!roster;
  const back = (
    <Link className="btn btn--collapse" to={campaignLink}>
      <ArrowLeft size={16} /> <span className="btn__collapse">Về đợt khám</span>
    </Link>
  );
  const head = (
    <>
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <div className="row row--wrap gap-2">
          <h1 className="page__title">Phiếu khám: {child.fullName}</h1>
          {m && <ChildResultBadge status={concluded ? CHILD_RESULT_STATUS.RECORDED : CHILD_RESULT_STATUS.IN_PROGRESS} size="lg" />}
        </div>
      </div>
      <p className="muted mb-16">
        {child.code} · {child.className} · sinh ngày {formatDate(child.dateOfBirth)} ({ageLabel(child.dateOfBirth)}) · {view.campaign.name}
      </p>
    </>
  );

  if (view.legacyMeasurementId)
    return (
      <div className="page">
        {head}
        <div className="card">
          <EmptyState
            icon={FileCheck2}
            title="Kết quả của trẻ trong đợt này nhập theo mẫu cũ"
            description="Kết quả được nhập trước khi có phiếu Phụ lục II. Xem và sửa số đo ở Sổ sức khỏe."
            action={
              <div className="row gap-2">
                {back}
                <Link className="btn btn--primary" to={`/children/${child.id}/health`}>
                  Mở sổ sức khỏe
                </Link>
              </div>
            }
          />
        </div>
      </div>
    );

  if (!m && !view.canEdit)
    return (
      <div className="page">
        {head}
        <div className="card">
          <EmptyState
            icon={view.locked ? Lock : Stethoscope}
            title={view.locked ? 'Đợt khám không mở để nhập phiếu' : 'Trẻ chưa có phiếu khám trong đợt này'}
            description={
              view.locked
                ? 'Đợt chưa bắt đầu, đã đóng hoặc đã hủy. Hiệu trưởng mở lại đợt nếu cần nhập phiếu.'
                : 'Chỉ giáo viên phụ trách lớp của trẻ nhập phiếu khám cùng bác sĩ.'
            }
            action={back}
          />
        </div>
      </div>
    );

  if (!form)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <LoadingState />
      </div>
    );

  // Ngày khám chỉ hiện: phiếu đã lưu giữ ngày, phiếu mới hiện ngày BE điền sẵn (hôm nay trong khoảng của đợt); BE ghi khi lưu.
  const examDate = m?.date || view.draft?.date || '';
  const update = (changes) => {
    setForm((f) => Object.entries(changes).reduce((acc, [p, v]) => setPath(acc, p, v), f));
    setErrors((e) => clearErrors(e, Object.keys(changes)));
    if (concluded) setReviewStale(true);
  };
  const set = (path, value) => update({ [path]: value });
  const payloadOf = (extra) => ({
    heightCm: form.heightCm,
    weightKg: form.weightKg,
    headCircumferenceCm: form.headCircumferenceCm,
    reason: form.reason,
    ...extra,
  });

  // Phiếu nháp tự lưu mỗi lần chuyển bước; lỗi lưu không làm mất dữ liệu đang nhập.
  const saveDraft = async (nextStep, { notify = false } = {}) => {
    if (!editable || concluded) return true;
    setBusy(true);
    try {
      const reached = Math.max(maxReached, nextStep);
      const res = await saveHealthExam(campaignId, childId, payloadOf({ exam: { ...form.exam, step: reached }, conclude: false }), user);
      setExamView(res);
      setReviewStale(false);
      if (notify) toast.success('Đã lưu nháp phiếu khám.');
      return true;
    } catch (err) {
      toast.error(err, 'Chưa lưu được nháp');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const refreshPreview = async () => {
    try {
      const res = await previewHealthExamReview(campaignId, childId, payloadOf({ exam: form.exam }), user);
      setPreviewPoints(res.reviewPoints);
      setReviewStale(false);
    } catch {
      // Không lấy được thì giữ danh sách của lần lưu gần nhất (có ghi chú).
    }
  };

  const goTo = async (i) => {
    await saveDraft(i);
    if (concluded && i === 4) await refreshPreview();
    setStep(i);
    setMaxReached((x) => Math.max(x, i));
    window.scrollTo({ top: 0 });
  };

  const nextChildId = () => {
    const rows = roster?.children || [];
    const idx = rows.findIndex((r) => r.childId === childId);
    const order = [...rows.slice(idx + 1), ...rows.slice(0, Math.max(idx, 0))];
    return (
      order.find((r) => [CHILD_RESULT_STATUS.NOT_RECORDED, CHILD_RESULT_STATUS.IN_PROGRESS].includes(r.result) && r.childId !== childId)
        ?.childId || null
    );
  };
  const examLink = (id) => `/children/health-checks/${campaignId}/exam/${id}${listQuery}`;

  const reviewPoints = (concluded ? previewPoints : null) || m?.reviewPoints || null;

  const conclude = async (andNext = false, confirmed = false) => {
    const payload = payloadOf({ exam: { ...form.exam, step: 4 }, conclude: true, conclusionMode: view.conclusionMode });
    const errs = validateHealthExam(payload, {
      dateOfBirth: child.dateOfBirth,
      examDate,
      reference: view.reference,
      requireReason: concluded,
      conclusionMode: view.conclusionMode,
      guardianCount: child.guardians.length,
    });
    if (hasErrors(errs)) {
      setErrors(errs);
      setStep(Math.min(...Object.keys(errs).map(stepOfField)));
      toast.error('Phiếu còn thiếu thông tin. Kiểm tra các ô được đánh dấu.', 'Chưa lưu được kết luận');
      return;
    }
    // Bác sĩ không chuyển khám (mẫu FOLLOW_UP: không ghi bất thường mới) mà vẫn còn điểm cần xem lại ⇒ hỏi lại 1 lần, không chặn.
    const c = form.exam.conclusion;
    const lines = reviewPointTexts(reviewPoints);
    const escalated =
      c.tbRisk ||
      (view.conclusionMode === CONCLUSION_MODE.FOLLOW_UP
        ? c.followUpFinding === FOLLOW_UP_FINDING.NEW_FINDING
        : c.action === CONCLUSION_ACTION.REFERRAL);
    if (!confirmed && lines.length > 0 && !escalated) {
      setConfirmConclude({ andNext, lines });
      return;
    }
    setBusy(true);
    try {
      const res = await saveHealthExam(campaignId, childId, payload, user);
      setExamView(res);
      setForm(formOf(res.measurement));
      setEditing(false);
      setErrors({});
      setReviewStale(false);
      if (andNext) {
        toast.success(`Đã lưu kết luận của ${child.fullName} và công bố cho phụ huynh.`);
        const next = nextChildId();
        if (next) navigate(examLink(next));
        else {
          toast.info('Đã khám xong các trẻ của lớp trong đợt khám.');
          navigate(campaignLink);
        }
        return;
      }
      setSaved(true);
      toast.success('Đã lưu kết luận và công bố cho phụ huynh.');
    } catch (err) {
      if (err.details) {
        setErrors(err.details);
        setStep(Math.min(...Object.keys(err.details).map(stepOfField)));
      }
      toast.error(err, 'Không lưu được kết luận');
    } finally {
      setBusy(false);
    }
  };

  // Màn kết quả ngay sau khi lưu kết luận: hệ thống đã làm gì, việc tiếp theo.
  if (saved && concluded) {
    const next = view.canEdit ? nextChildId() : null;
    return (
      <div className="page">
        {head}
        <section className="card wizard-card">
          <div className="row mb-12 gap-2">
            <CheckCircle2 size={20} className="text-success" />
            <h2 className="card__title">Đã lưu kết luận phiếu khám ngày {formatDate(m.date)}</h2>
          </div>
          <div className="row row--wrap gap-2 mb-12">
            <ConclusionCategoryBadge status={m.conclusionCategory} size="lg" />
            <FollowUpLevelBadge status={m.followUpLevel} />
          </div>
          <p className="m-0">{conclusionSentence(m.exam.conclusion)}</p>
          {m.published && (
            <div className="alert alert--success mt-16">
              <Send size={18} />
              <div>Đã công bố cho phụ huynh khi lưu kết luận. Phụ huynh nhận thông báo trên ứng dụng.</div>
            </div>
          )}
          {/* Không còn phiếu theo dõi (HLT-16 bỏ): kết luận là cảnh báo ở Sổ sức khỏe, không có việc theo dõi sau khám. */}
          {m.conclusionCategory === CONCLUSION_CATEGORY.TB_RISK && (
            <div className="alert alert--danger mt-16">
              <ShieldAlert size={18} />
              <div>
                Trẻ có nguy cơ mắc lao (tiền sử tiếp xúc). Cảnh báo hiện ở Sổ sức khỏe của trẻ và danh sách trẻ cần theo dõi của đợt khám.
              </div>
            </div>
          )}
        </section>
        <div className="page-actions">
          <div className="row gap-2">
            <button className="btn" onClick={() => setSaved(false)}>
              <FileCheck2 size={16} /> Xem phiếu
            </button>
            {back}
          </div>
          <div className="row gap-2">
            {next && (
              <Link className="btn" to={examLink(next)}>
                Khám trẻ tiếp theo <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Chế độ xem: phiếu đã kết luận (chưa bấm sửa), hoặc người xem không nhập được.
  if (!editable)
    return (
      <div className="page">
        {head}
        {view.locked && (
          <div className="alert alert--info mb-16">
            <Lock size={18} />
            <div>Đợt khám đã đóng, phiếu bị khóa. Hiệu trưởng mở lại đợt nếu cần sửa.</div>
          </div>
        )}
        {!concluded && (
          <div className="alert alert--warning mb-16">
            <Info size={18} />
            <div>Phiếu chưa có kết luận của bác sĩ{view.locked ? ' (đợt đã đóng khi phiếu còn đang khám)' : ''}.</div>
          </div>
        )}
        {concluded && (
          <div className="row row--wrap gap-2 mb-16">
            <ConclusionCategoryBadge status={m.conclusionCategory} size="lg" />
            <FollowUpLevelBadge status={m.followUpLevel} />
            <PublishStatusBadge status={m.published ? 'PUBLISHED' : 'UNPUBLISHED'} />
          </div>
        )}
        <div className="stack gap-4">
          <ExamSummary measurement={m} child={child} campaign={view.campaign} reference={view.reference} />
          <ExamReviewCard points={m.reviewPoints} />
          {m.edits?.length > 0 && (
            <section className="card">
              <div className="card__header">
                <h2 className="card__title">Lịch sử sửa phiếu</h2>
              </div>
              <div className="card__body">
                <ul className="history-list">
                  {[...m.edits].reverse().map((ed, i) => (
                    <li key={`${ed.at}${i}`}>
                      <span className="history-list__dot" />
                      <div>
                        <div className="fw-600">
                          {ed.userName || '—'} · {formatDateTime(ed.at)}
                        </div>
                        <div className="text-sm">Lý do: {ed.reason}</div>
                        <ul className="tr-change-list text-sm">
                          {ed.changes.map((c) => (
                            <li key={c.field}>
                              {c.label}: <s className="muted">{formatMeasurementChange(c.field, c.from)}</s> →{' '}
                              <b>{formatMeasurementChange(c.field, c.to)}</b>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
        <div className="page-actions">
          {back}
          {concluded && view.canEdit && (
            <div className="row gap-2">
              <button
                className="btn"
                onClick={() => {
                  setEditing(true);
                  setPreviewPoints(null);
                  setStep(0);
                  setMaxReached(4);
                }}
              >
                <Pencil size={16} /> Sửa phiếu
              </button>
            </div>
          )}
        </div>
      </div>
    );

  const stepProps = { form, set, setMany: update, errors };
  return (
    <div className="page">
      {head}
      {editing && (
        <div className="alert alert--warning mb-16">
          <Info size={18} />
          <div>
            Bạn đang sửa phiếu đã có kết luận. Lưu lại kết luận cần ghi lý do; phiếu tự công bố lại và phụ huynh nhận thông báo kết quả đã
            cập nhật.
          </div>
        </div>
      )}
      <PreviousNotes view={view} />
      <div className="card stepper-card">
        <Stepper steps={STEP_LABELS} current={step} maxReached={maxReached} onStepClick={busy ? undefined : goTo} />
      </div>
      <div className="stack gap-4 mt-16">
        {step === 0 && <ExamAdminStep {...stepProps} child={child} campaign={view.campaign} examDate={examDate} examSaved={!!m} />}
        {step === 1 && <ExamMeasureStep {...stepProps} reference={view.reference} />}
        {step === 2 && <ExamDevelopmentStep {...stepProps} reference={view.reference} />}
        {step === 3 && <ExamClinicalStep {...stepProps} />}
        {step === 4 && (
          <ExamConclusionStep
            {...stepProps}
            reviewPoints={reviewPoints}
            reviewStale={reviewStale}
            doctorNames={view.doctorNames}
            requireReason={concluded}
            mode={view.conclusionMode}
          />
        )}
        {step === 4 && (
          <div className="alert alert--info">
            <Send size={18} />
            <div>
              Lưu kết luận là <b>công bố cho phụ huynh ngay</b>; phụ huynh xem được {PARENT_VISIBLE_HEALTH_TEXT} trên ứng dụng. Kết luận là
              cảnh báo của lần khám ở Sổ sức khỏe.
            </div>
          </div>
        )}
      </div>
      {/* Điện thoại (user chọn 1 hàng, 2026-11-04): nút phụ chỉ còn biểu tượng, "Tiếp" bỏ tên bước; bước Kết luận khi khám theo lớp
          gom Lưu nháp, Lưu kết luận vào nút "…" để nút chính "Lưu, khám trẻ tiếp" vừa một hàng */}
      <div className="page-actions page-actions--sticky">
        {step > 0 ? (
          <button className="btn btn--collapse wizard-actions__back" onClick={() => goTo(step - 1)} disabled={busy}>
            <ArrowLeft size={16} /> <span className="btn__collapse">Quay lại</span>
          </button>
        ) : editing ? (
          <button
            className="btn btn--collapse wizard-actions__back"
            onClick={() => {
              setForm(formOf(m));
              setErrors({});
              setEditing(false);
              setReviewStale(false);
            }}
          >
            <ArrowLeft size={16} /> <span className="btn__collapse">Hủy sửa</span>
          </button>
        ) : (
          back
        )}
        <div className="row gap-2">
          {!concluded && (
            <button
              className={`btn btn--collapse${saveMenu ? ' page-actions__desk' : ''}`}
              onClick={() => saveDraft(step, { notify: true })}
              disabled={busy}
            >
              <Save size={16} /> <span className="btn__collapse">Lưu nháp</span>
            </button>
          )}
          {step < 4 ? (
            <button className="btn btn--primary" onClick={() => goTo(step + 1)} disabled={busy}>
              {/* Một span bao cả nhãn: "Tiếp" và phần tên bước không bị khoảng cách (gap) của nút tách ra */}
              {busy ? <Spinner small /> : null}{' '}
              <span>
                Tiếp<span className="btn__collapse">: {STEP_LABELS[step + 1]}</span>
              </span>{' '}
              <ArrowRight size={16} />
            </button>
          ) : (
            <>
              {saveMenu && (
                <span className="page-actions__phone">
                  <RowMenu
                    label="Cách lưu khác"
                    items={[
                      { label: 'Lưu nháp', icon: Save, disabled: busy, onClick: () => saveDraft(step, { notify: true }) },
                      { label: 'Lưu kết luận', icon: Save, disabled: busy, onClick: () => conclude(false) },
                    ]}
                  />
                </span>
              )}
              <button className={`btn ${saveMenu ? 'page-actions__desk' : 'btn--primary'}`} onClick={() => conclude(false)} disabled={busy}>
                {busy ? <Spinner small /> : <Save size={16} />} Lưu kết luận
              </button>
              {saveMenu && (
                <button className="btn btn--primary" onClick={() => conclude(true)} disabled={busy}>
                  {busy ? <Spinner small /> : <Save size={16} />} <span className="btn__collapse">Lưu kết luận và khám trẻ tiếp theo</span>
                  <span className="btn__phone" aria-hidden="true">
                    Lưu, khám trẻ tiếp
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <ConfirmationModal
        open={!!confirmConclude}
        title="Bác sĩ vẫn kết luận như vậy?"
        message={confirmConclude ? `Còn ${confirmConclude.lines.length} điểm cần bác sĩ xem lại:` : ''}
        confirmLabel="Lưu theo bác sĩ"
        cancelLabel="Quay lại xem"
        onConfirm={async () => {
          const { andNext } = confirmConclude;
          setConfirmConclude(null);
          await conclude(andNext, true);
        }}
        onClose={() => setConfirmConclude(null)}
      >
        {confirmConclude && (
          <>
            <ul className="tr-review__signs mt-8">
              {confirmConclude.lines.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="mt-8 m-0">
              Kết luận đang chọn: <b>{conclusionLabelOf(form.exam.conclusion)}</b>
              {conclusionActionLabelOf(form.exam.conclusion) ? ` · ${conclusionActionLabelOf(form.exam.conclusion)}` : ''}. Gợi ý không phải
              kết luận; bác sĩ quyết định.
            </p>
          </>
        )}
      </ConfirmationModal>
    </div>
  );
}
