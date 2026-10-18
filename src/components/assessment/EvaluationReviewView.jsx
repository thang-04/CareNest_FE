import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertOctagon, ArrowLeft, Award, CheckCircle2, Copy, History, Lock, RefreshCw, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useEvaluation } from '@/hooks/assessment/useAssessment';
import { confirmEvaluation, regenerateEvaluationDraft, saveEvaluationDraft } from '@/services/assessment/assessmentService';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { AiDraftTag, EvaluationStatusBadge } from '@/components/assessment/AssessmentBadges';
import { PeriodSummaryTable } from '@/components/assessment/PeriodSummaryTable';
import { EMOTION_LABELS, EVAL_HISTORY_LABELS, EVAL_KIND, EVAL_STATUS, PERIOD_TYPE_LABELS } from '@/models/assessment/assessmentConstants';
import { BEHAVIORS, NAP, NAP_LABELS } from '@/models/assessment/dailyObservationOptions';
import { HEALTH_SYMPTOMS } from '@/utils/dailyHealthValidation';
import { mealsText } from '@/components/assessment/DailyAssessmentCells';
import { formatDate, formatDateTime } from '@/utils/format';
import { evaluationPeriodLabel, periodLabel } from '@/utils/assessment/assessmentPeriods';
import { canReviewEvaluation, canViewAiDraft, isClassTeacher } from '@/utils/assessment/assessmentPermissions';
import { ChildAvatar } from '@/components/ChildAvatar';
import { validateEvaluationContent, hasErrors } from '@/utils/assessment/assessmentValidation';

const MSG30 = 'Trợ lý AI hiện không khả dụng. Bạn có thể tiếp tục viết đánh giá thủ công.';

const GoalChip = ({ goal, tone }) => (
  <span className={`chip chip--${tone}`} title={goal.description || goal.name}>
    {goal.name}
  </span>
);

/** Đánh giá hằng ngày trong kỳ, mỗi ngày một dòng, cùng cột với màn Đánh giá hằng ngày (căn cứ của bản nháp AI). */
function DayTable({ days, mealSessions, classId, linkDays }) {
  if (!days.length) return <div className="muted">Không có đánh giá hằng ngày nào trong kỳ.</div>;
  const dash = <span className="muted">—</span>;
  return (
    <div className="table-wrap">
      <table className="table table--grid dg-days">
        <thead>
          <tr>
            <th>Ngày</th>
            <th>Sức khỏe</th>
            <th>Ăn</th>
            <th>Ngủ</th>
            <th>Cảm xúc</th>
            <th>Hành vi</th>
            <th>Kiến thức, kỹ năng</th>
            <th>Nhận xét</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td className="nowrap">
                {linkDays ? (
                  <Link to={`/assessment/daily?classId=${classId}&date=${d.date}`} title="Mở đánh giá hằng ngày của ngày này">
                    {formatDate(d.date)}
                  </Link>
                ) : (
                  formatDate(d.date)
                )}
              </td>
              <td className={d.health?.signs.length ? 'dg-cell--warn' : ''}>
                {d.health ? (
                  <>
                    {d.health.signs.length ? d.health.signs.map((x) => HEALTH_SYMPTOMS[x] || x).join(', ') : 'Bình thường'}
                    {d.health.note && <div className="muted text-xs">{d.health.note}</div>}
                  </>
                ) : (
                  dash
                )}
              </td>
              <td>{d.meals ? mealsText(d.meals, mealSessions) : dash}</td>
              <td className={d.nap && d.nap !== NAP.NGU_TOT ? 'dg-cell--warn' : ''}>{d.nap ? NAP_LABELS[d.nap] : dash}</td>
              <td>{d.emotion ? EMOTION_LABELS[d.emotion] : dash}</td>
              <td>
                {d.behaviors.length ? d.behaviors.map((x) => BEHAVIORS[x] || x).join(', ') : dash}
                {d.behaviorNote && <div className="muted text-xs">{d.behaviorNote}</div>}
              </td>
              <td>
                {d.met.length || d.notMet.length ? (
                  <div className="dg-days__goals">
                    {d.met.map((g) => (
                      <GoalChip key={g.id} goal={g} tone="green" />
                    ))}
                    {d.notMet.map((g) => (
                      <GoalChip key={g.id} goal={g} tone="orange" />
                    ))}
                  </div>
                ) : (
                  dash
                )}
              </td>
              <td className="dg-days__comment">{d.comment || dash}</td>
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
  const label = evaluationPeriodLabel(ev);
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

  return (
    <>
      <div className="page__head">
        <div className="dg-eval-head">
          <ChildAvatar child={detail.child || { fullName: ev.childName }} size="lg" />
          <div>
            <h1 className="page__title" style={{ marginBottom: 6 }}>
              Đánh giá {PERIOD_TYPE_LABELS[ev.periodType].toLowerCase()} – {ev.childName}
            </h1>
            <div className="dg-eval-meta">
              <EvaluationStatusBadge status={ev.status} />
              <span>{ev.className}</span>
              <span>{label}</span>
              {ev.themeName && <span>Chủ đề: {ev.themeName}</span>}
              <span>Có mặt {detail.summary.presentDays} ngày</span>
              {!yearEnd && <span>Đánh giá hằng ngày {detail.summary.assessedDays} ngày</span>}
              {confirmed && (
                <span>
                  Xác nhận bởi {name(ev.confirmedBy)} · {formatDateTime(ev.confirmedAt)}
                </span>
              )}
            </div>
          </div>
        </div>
        {yearEnd && confirmed && isClassTeacher(detail.cls, user) && (
          <Link className="btn btn--outline-primary" to={`/assessment/rewards/new?childId=${ev.childId}&classId=${ev.classId}`}>
            <Award size={16} /> Đề xuất khen thưởng
          </Link>
        )}
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
              <div className="card__title">Bản nháp AI</div>
              <AiDraftTag />
            </div>
            <div className="card__body">
              {ev.aiDraft ? (
                <>
                  <div className="dg-ai-box text-sm">{ev.aiDraft.content}</div>
                  <div className="muted text-xs mt-8">
                    {yearEnd
                      ? `Tổng hợp từ ${detail.monthlyEvaluations.length} đánh giá tháng đã xác nhận`
                      : `Tổng hợp từ ${detail.summary.assessedDays} ngày đánh giá hằng ngày`}{' '}
                    · tạo lúc {formatDateTime(ev.aiDraft.generatedAt)}
                  </div>
                  <div className="row row--wrap mt-12" style={{ gap: 8 }}>
                    <button
                      className="btn btn--sm"
                      onClick={() => setContent(ev.aiDraft.content)}
                      disabled={!!busy || content === ev.aiDraft.content}
                    >
                      <Copy size={14} /> Dùng bản nháp này
                    </button>
                    <button className="btn btn--sm" onClick={redraft} disabled={!!busy}>
                      {busy === 'redraft' ? <Spinner small /> : <RefreshCw size={14} />} Tạo lại bản nháp
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

      <PeriodSummaryTable data={detail.summary.structured} />

      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">{yearEnd ? 'Đánh giá tháng đã xác nhận trong năm học' : 'Đánh giá hằng ngày trong kỳ'}</div>
          {!yearEnd && <span className="muted text-sm">Xanh: đạt · Cam: chưa đạt</span>}
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
            <DayTable days={detail.days} mealSessions={detail.mealSessions} classId={ev.classId} linkDays={canReview} />
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
