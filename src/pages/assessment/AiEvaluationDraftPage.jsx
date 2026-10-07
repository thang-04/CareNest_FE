import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AlertOctagon, ArrowLeft, FileCheck2, Lock, PenLine, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useEvaluation } from '@/hooks/assessment/useAssessment';
import { regenerateEvaluationDraft } from '@/services/assessment/assessmentService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { AiDraftTag, EvaluationStatusBadge } from '@/components/assessment/AssessmentBadges';
import { EVAL_KIND, EVAL_STATUS, PERIOD_TYPE_LABELS } from '@/models/assessment/assessmentConstants';
import { formatDateTime } from '@/utils/format';
import { periodLabel } from '@/utils/assessment/assessmentPeriods';
import { canReviewEvaluation, canViewAiDraft } from '@/utils/assessment/assessmentPermissions';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

const MSG30 = 'Trợ lý AI hiện không khả dụng. Bạn có thể tiếp tục viết đánh giá thủ công.';

/**
 * #57 AI Evaluation Draft (UC 4.7): the weekly, monthly or year-end draft written by the AI service and its sources.
 * The draft is never official; the teacher can request a new one and confirms on the detail page.
 */
export default function AiEvaluationDraftPage() {
  const { id } = useParams();
  const { pathname } = useLocation();
  const kind = pathname.includes('/year-end/') ? EVAL_KIND.YEAR_END : EVAL_KIND.PERIODIC;
  const base = `/assessment/${kind === EVAL_KIND.YEAR_END ? 'year-end' : 'periodic'}`;
  const section = kind === EVAL_KIND.YEAR_END ? SECTIONS.yearEnd : SECTIONS.periodic;
  const { user } = useAuth();
  const toast = useToast();
  const { detail, loading, error, reload } = useEvaluation(kind, id);
  const [busy, setBusy] = useState(false);

  const redraft = async () => {
    setBusy(true);
    try {
      const res = await regenerateEvaluationDraft(kind, id, user);
      if (res.status === EVAL_STATUS.AI_FAILED) toast.warning(res.aiError || MSG30, 'AI chưa tạo được bản nháp');
      else toast.success('Bản nháp AI mới đã sẵn sàng để bạn xem xét.');
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message || MSG30, 'AI chưa tạo được bản nháp');
    } finally {
      setBusy(false);
    }
  };

  const body = () => {
    if (loading) return <LoadingState />;
    if (error) {
      if (error.status === 403 || error.status === 404)
        return (
          <div className="card">
            <EmptyState
              icon={Lock}
              title="Không xem được bản nháp"
              description="Bản nháp không tồn tại hoặc nằm ngoài lớp bạn phụ trách."
            />
          </div>
        );
      return <ErrorState error={error} onRetry={reload} />;
    }
    const ev = detail.evaluation;
    if (!canViewAiDraft(ev, detail.cls, user))
      return (
        <div className="card">
          <EmptyState icon={Lock} title="Không xem được bản nháp" description="Bản nháp AI chỉ dành cho giáo viên của lớp." />
        </div>
      );
    const canRedraft = canReviewEvaluation(ev, detail.cls, user);
    const src = ev.aiDraft?.source;
    const critName = Object.fromEntries(detail.criteria.map((c) => [c.id, c.name]));
    return (
      <>
        <div className="page__head">
          <div>
            <h1 className="page__title" style={{ marginBottom: 6 }}>
              Bản nháp AI – {ev.childName}
            </h1>
            <div className="row row--wrap" style={{ gap: 8 }}>
              <EvaluationStatusBadge status={ev.status} size="lg" />
              <AiDraftTag />
            </div>
          </div>
        </div>
        <div className="alert alert--purple mt-16">
          <ShieldAlert size={18} />
          <div>
            Nội dung do AI tạo chỉ là gợi ý từ các hồ sơ đã ghi nhận. Bản nháp không được gửi cho phụ huynh và không quyết định khen thưởng;
            giáo viên phải xem xét, chỉnh sửa và xác nhận.
          </div>
        </div>

        <div className="card mt-16">
          <div className="card__header">
            <div className="card__title">
              {PERIOD_TYPE_LABELS[ev.periodType]} · {periodLabel(ev.periodType, ev.periodStart, ev.periodEnd)} · {ev.className}
            </div>
            {ev.aiDraft && <span className="muted text-sm">Tạo lúc {formatDateTime(ev.aiDraft.generatedAt)}</span>}
          </div>
          <div className="card__body">
            {ev.aiDraft ? (
              <div className="dg-ai-box">{ev.aiDraft.content}</div>
            ) : (
              <div className="alert alert--danger">
                <AlertOctagon size={18} />
                <div>
                  <div className="fw-600">{MSG30}</div>
                  {ev.aiError && <div className="text-sm mt-8">{ev.aiError}</div>}
                </div>
              </div>
            )}
            {ev.status === EVAL_STATUS.CONFIRMED && (
              <div className="muted text-sm mt-12">Đánh giá đã được xác nhận nên không thể tạo lại bản nháp.</div>
            )}
          </div>
        </div>

        {src && (
          <div className="card mt-16">
            <div className="card__header">
              <div className="card__title">Dữ liệu nguồn AI đã dùng</div>
            </div>
            <div className="card__body">
              <dl className="info-list info-columns">
                <dt>Số ngày có mặt:</dt>
                <dd>{src.presentDays}</dd>
                <dt>Lượt đánh giá hằng ngày:</dt>
                <dd>{src.assessmentCount}</dd>
                <dt>Cờ bé ngoan:</dt>
                <dd>{src.flagCount}</dd>
                <dt>Hoạt động:</dt>
                <dd>{src.activities.join(', ') || '—'}</dd>
                {kind === EVAL_KIND.YEAR_END && (
                  <>
                    <dt>Đánh giá tháng đã xác nhận:</dt>
                    <dd>{src.monthlyCount}</dd>
                  </>
                )}
              </dl>
              <div className="table-wrap mt-12">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Tiêu chí</th>
                      <th className="right">Số lượt đạt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(src.criteriaCounts).map(([cid, n]) => (
                      <tr key={cid}>
                        <td>{critName[cid] || cid}</td>
                        <td className="right">{n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="page-actions">
          <Link className="btn" to={`${base}/${id}`}>
            <ArrowLeft size={16} /> Về chi tiết đánh giá
          </Link>
          {canRedraft && (
            <div className="row" style={{ gap: 8 }}>
              <button className="btn" onClick={redraft} disabled={busy}>
                {busy ? <Spinner small /> : <RefreshCw size={16} />} Yêu cầu tạo lại bản nháp
              </button>
              <Link className="btn btn--primary" to={`${base}/${id}`}>
                {ev.aiDraft ? <FileCheck2 size={16} /> : <PenLine size={16} />}{' '}
                {ev.aiDraft ? 'Xem xét và xác nhận' : 'Viết đánh giá thủ công'}
              </Link>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(section, 'Bản nháp AI')} />
      {body()}
    </div>
  );
}
