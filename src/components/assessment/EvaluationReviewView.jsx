import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertOctagon, ArrowLeft, Award, CheckCircle2, Copy, Flag, History, Lock, RefreshCw, Save, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useEvaluation } from '@/hooks/assessment/useAssessment';
import { confirmEvaluation, regenerateEvaluationDraft, saveEvaluationDraft } from '@/services/assessment/assessmentService';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { AiDraftTag, EvaluationStatusBadge } from '@/components/assessment/AssessmentBadges';
import {
  EMOTION_LABELS,
  EVAL_HISTORY_LABELS,
  EVAL_KIND,
  EVAL_STATUS,
  HEALTH_STATUS_LABELS,
  PERIOD_TYPE_LABELS,
} from '@/models/assessment/assessmentConstants';
import { formatDate, formatDateTime } from '@/utils/format';
import { periodLabel } from '@/utils/assessment/assessmentPeriods';
import { canReviewEvaluation, canViewAiDraft, isClassTeacher } from '@/utils/assessment/assessmentPermissions';
import { validateEvaluationContent, hasErrors } from '@/utils/assessment/assessmentValidation';

const MSG30 = 'Trợ lý AI hiện không khả dụng. Bạn có thể tiếp tục viết đánh giá thủ công.';

function SourceAssessments({ assessments, criteria }) {
  const name = Object.fromEntries(criteria.map((c) => [c.id, c.name]));
  if (!assessments.length) return <div className="muted">Không có đánh giá hằng ngày nào trong kỳ.</div>;
  return (
    <div className="table-wrap">
      <table className="table table--compact">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Hoạt động</th>
            <th>Sức khỏe</th>
            <th>Cảm xúc</th>
            <th>Tiêu chí đạt</th>
            <th className="center">Cờ</th>
            <th>Nhận xét</th>
          </tr>
        </thead>
        <tbody>
          {assessments.map((a) => (
            <tr key={a.id}>
              <td className="nowrap">{formatDate(a.date)}</td>
              <td>{a.activity}</td>
              <td>{HEALTH_STATUS_LABELS[a.healthStatus]}</td>
              <td>{EMOTION_LABELS[a.emotion]}</td>
              <td className="text-sm" style={{ whiteSpace: 'normal', minWidth: 200 }}>
                {a.criteriaMet
                  .map((id) => name[id])
                  .filter(Boolean)
                  .join(', ') || '—'}
              </td>
              <td className="center">{a.flag ? <Flag size={15} className="text-primary" aria-label="Có cờ" /> : '—'}</td>
              <td className="text-sm" style={{ whiteSpace: 'normal', minWidth: 160 }}>
                {a.comment || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Shared body of #56 Periodic Evaluation Detail and #59 Year-end Evaluation Detail (UC 4.5, 4.6). */
export function EvaluationReviewView({ kind, id }) {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const { detail, loading, error, reload } = useEvaluation(kind, id, { live: false });
  const [content, setContent] = useState('');
  const [contentError, setContentError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const yearEnd = kind === EVAL_KIND.YEAR_END;
  const base = `/assessment/${yearEnd ? 'year-end' : 'periodic'}`;

  const ev = detail?.evaluation;
  useEffect(() => {
    if (ev) setContent(ev.finalContent || ev.aiDraft?.content || '');
  }, [ev]);

  if (loading) return <LoadingState />;
  if (error) {
    if (error.status === 403 || error.status === 404)
      return (
        <div className="card">
          <EmptyState icon={Lock} title="Không xem được đánh giá" description="Đánh giá không tồn tại hoặc nằm ngoài phạm vi của bạn." />
        </div>
      );
    return <ErrorState error={error} onRetry={reload} />;
  }
  if (!detail) return null;

  const canReview = canReviewEvaluation(ev, detail.cls, user);
  const showDraft = canViewAiDraft(ev, detail.cls, user);
  const confirmed = ev.status === EVAL_STATUS.CONFIRMED;
  const label = periodLabel(ev.periodType, ev.periodStart, ev.periodEnd);
  const name = (uid) => md.userById(uid)?.fullName || 'Hệ thống';

  const check = () => {
    const errors = validateEvaluationContent(content);
    setContentError(errors.content || '');
    return !hasErrors(errors);
  };

  const run = async (key, fn, success) => {
    setBusy(key);
    try {
      const res = await fn();
      if (success) toast.success(success(res));
      await reload({ silent: true });
      return res;
    } catch (err) {
      toast.error(err.message, 'Không thực hiện được');
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

  const redraft = async () => {
    setBusy('redraft');
    try {
      const res = await regenerateEvaluationDraft(kind, ev.id, user);
      if (res.status === EVAL_STATUS.AI_FAILED) toast.warning(res.aiError || MSG30, 'AI chưa tạo được bản nháp');
      else toast.success('Bản nháp AI mới đã sẵn sàng để bạn xem xét.');
      await reload({ silent: true });
    } catch (err) {
      toast.error(err.message || MSG30, 'AI chưa tạo được bản nháp');
    } finally {
      setBusy('');
    }
  };

  const doConfirm = async () => {
    const res = await run(
      'confirm',
      () => confirmEvaluation(kind, ev.id, content, user),
      () => 'Đánh giá đã được xác nhận thành công.',
    );
    setConfirmOpen(false);
    return res;
  };

  const steps = [
    {
      label: 'AI tạo bản nháp',
      sub: ev.aiDraft ? formatDateTime(ev.aiDraft.generatedAt) : ev.status === EVAL_STATUS.AI_FAILED ? 'Chưa tạo được' : '',
      done: !!ev.aiDraft || confirmed,
      warn: ev.status === EVAL_STATUS.AI_FAILED,
    },
    { label: 'Giáo viên xem xét, bổ sung', done: confirmed },
    {
      label: yearEnd ? 'Xác nhận – dùng cho khen thưởng' : 'Xác nhận và công bố',
      sub: confirmed ? formatDateTime(ev.confirmedAt) : '',
      done: confirmed,
    },
  ];

  return (
    <>
      <div className="page__head">
        <div>
          <h1 className="page__title" style={{ marginBottom: 6 }}>
            Đánh giá {PERIOD_TYPE_LABELS[ev.periodType].toLowerCase()} – {ev.childName}
          </h1>
          <EvaluationStatusBadge status={ev.status} size="lg" />
        </div>
        <div className="row row--wrap" style={{ gap: 8, marginTop: 8 }}>
          {showDraft && (ev.aiDraft || ev.aiError) && (
            <Link className="btn" to={`${base}/${ev.id}/ai-draft`}>
              <Sparkles size={16} /> Xem bản nháp AI
            </Link>
          )}
          {yearEnd && confirmed && isClassTeacher(detail.cls, user) && (
            <Link className="btn btn--outline-primary" to={`/assessment/rewards/new?childId=${ev.childId}&classId=${ev.classId}`}>
              <Award size={16} /> Đề xuất khen thưởng
            </Link>
          )}
        </div>
      </div>

      <div className="card mt-16" style={{ padding: '20px 24px' }}>
        <ProgressSteps steps={steps} />
      </div>

      <div className="card mt-16">
        <div className="card__body">
          <dl className="info-list info-columns">
            <dt>Trẻ:</dt>
            <dd className="fw-600">
              {ev.childName} <span className="muted">· {ev.childCode}</span>
            </dd>
            <dt>Lớp:</dt>
            <dd>{ev.className}</dd>
            <dt>Kỳ đánh giá:</dt>
            <dd>{label}</dd>
            <dt>Số ngày có mặt:</dt>
            <dd>{detail.summary.presentDays}</dd>
            <dt>Lượt đánh giá hằng ngày:</dt>
            <dd>{detail.summary.assessmentCount}</dd>
            <dt>Cờ bé ngoan:</dt>
            <dd>{detail.summary.flagCount}</dd>
          </dl>
        </div>
      </div>

      {ev.status === EVAL_STATUS.AI_FAILED && canReview && (
        <div className="alert alert--danger mt-16">
          <AlertOctagon size={20} />
          <div style={{ flex: 1 }}>
            <div className="fw-600">{MSG30}</div>
            <div className="mt-8 text-sm">{ev.aiError}</div>
          </div>
          <button className="btn" onClick={redraft} disabled={!!busy}>
            {busy === 'redraft' ? <Spinner small /> : <RefreshCw size={16} />} Yêu cầu tạo lại bản nháp
          </button>
        </div>
      )}

      {canReview ? (
        <div className="split-2 mt-16">
          <div className="card">
            <div className="card__header">
              <div className="card__title">Bản nháp do AI đề xuất</div>
              <AiDraftTag />
            </div>
            <div className="card__body">
              {ev.aiDraft ? (
                <>
                  <div className="dg-ai-box text-sm">{ev.aiDraft.content}</div>
                  <div className="muted text-xs mt-8">
                    Tạo lúc {formatDateTime(ev.aiDraft.generatedAt)}. Hãy đối chiếu với các đánh giá hằng ngày bên dưới.
                  </div>
                  <div className="row row--wrap mt-12" style={{ gap: 8 }}>
                    <button className="btn btn--sm" onClick={() => setContent(ev.aiDraft.content)} disabled={!!busy}>
                      <Copy size={14} /> Dùng lại nội dung bản nháp
                    </button>
                    <button className="btn btn--sm" onClick={redraft} disabled={!!busy}>
                      {busy === 'redraft' ? <Spinner small /> : <RefreshCw size={14} />} Yêu cầu tạo lại bản nháp
                    </button>
                  </div>
                </>
              ) : (
                <div className="muted">Chưa có bản nháp AI. Bạn có thể tự viết đánh giá ở khung bên cạnh.</div>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card__header">
              <div className="card__title">Đánh giá chính thức</div>
            </div>
            <div className="card__body">
              <FormField
                label="Nội dung đánh giá"
                required
                error={contentError}
                hint="Chỉnh sửa, bổ sung dựa trên quan sát thực tế. Không dùng thuật ngữ chẩn đoán."
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
                <div className="muted text-sm mt-12">
                  Xác nhận bởi {name(ev.confirmedBy)} · {formatDateTime(ev.confirmedAt)}
                </div>
              </>
            ) : (
              <div className="muted">Đánh giá chưa được giáo viên xác nhận.</div>
            )}
          </div>
        </div>
      )}

      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">{yearEnd ? 'Đánh giá tháng đã xác nhận trong năm học' : 'Đánh giá hằng ngày làm căn cứ'}</div>
          {!yearEnd && detail.summary.activities.length > 0 && (
            <span className="muted text-sm">Hoạt động: {detail.summary.activities.join(', ')}</span>
          )}
        </div>
        <div className="card__body">
          {yearEnd ? (
            detail.monthlyEvaluations.length ? (
              <div className="stack">
                {detail.monthlyEvaluations.map((m) => (
                  <div key={m.id}>
                    <div className="fw-600">{periodLabel(m.periodType, m.periodStart, m.periodEnd)}</div>
                    <div className="dg-final text-sm text-2">{m.finalContent}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted">Chưa có đánh giá tháng nào được xác nhận. Thiếu dữ liệu nguồn – hãy xem lại các hồ sơ hiện có.</div>
            )
          ) : (
            <SourceAssessments assessments={detail.assessments} criteria={detail.criteria} />
          )}
        </div>
      </div>

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
                      <b>{EVAL_HISTORY_LABELS[h.action] || h.action}</b> · {name(h.userId)}
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
        <button className="btn" onClick={() => navigate(base)}>
          <ArrowLeft size={16} /> Về danh sách
        </button>
        {canReview && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={save} disabled={!!busy}>
              {busy === 'save' ? <Spinner small /> : <Save size={16} />} Lưu chỉnh sửa
            </button>
            <button className="btn btn--primary" onClick={() => check() && setConfirmOpen(true)} disabled={!!busy}>
              <CheckCircle2 size={16} /> {yearEnd ? 'Xác nhận đánh giá' : 'Xác nhận và công bố'}
            </button>
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
        confirmLabel={yearEnd ? 'Xác nhận đánh giá' : 'Xác nhận và công bố'}
        onConfirm={doConfirm}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
