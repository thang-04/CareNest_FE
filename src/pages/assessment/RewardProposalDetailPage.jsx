import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileText,
  History,
  Lock,
  Pencil,
  Send,
  Trash2,
  Undo2,
  XCircle,
} from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useRewardProposal } from '@/hooks/assessment/useAssessment';
import { decideRewardProposal, deleteRewardProposal, reviewRewardProposal } from '@/services/assessment/assessmentService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { RewardStatusBadge } from '@/components/assessment/AssessmentBadges';
import { REWARD_HISTORY_LABELS, REWARD_STATUS as S } from '@/models/assessment/assessmentConstants';
import { formatDateTime } from '@/utils/format';
import {
  canDecideRewardProposal,
  canDeleteRewardProposal,
  canEditRewardProposal,
  canReviewRewardProposal,
} from '@/utils/assessment/assessmentPermissions';
import { validateDecision } from '@/utils/assessment/assessmentValidation';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

/* Decision dialogs: VP forward / return (UC 4.3), Principal approve / reject (UC 4.2). */
const DECISIONS = {
  FORWARD: {
    title: 'Chuyển Hiệu trưởng phê duyệt?',
    label: 'Chuyển Hiệu trưởng',
    negative: false,
    msg: 'Đề xuất hợp lệ sẽ được chuyển Hiệu trưởng phê duyệt.',
  },
  RETURN: {
    title: 'Trả lại đề xuất?',
    label: 'Trả lại đề xuất',
    negative: true,
    msg: 'Đề xuất được trả về giáo viên để chỉnh sửa và gửi lại.',
  },
  APPROVE: {
    title: 'Phê duyệt khen thưởng?',
    label: 'Phê duyệt',
    negative: false,
    msg: 'Khen thưởng được công bố cho giáo viên, Phó hiệu trưởng và phụ huynh.',
  },
  REJECT: {
    title: 'Từ chối đề xuất?',
    label: 'Từ chối đề xuất',
    negative: true,
    msg: 'Đề xuất bị từ chối sẽ không tạo kết quả khen thưởng.',
  },
};

/** #63 Reward Proposal Detail: Vice Principal reviews, then the Principal approves or rejects with a reason. */
export default function RewardProposalDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const { detail, loading, error, reload } = useRewardProposal(id);
  const [decision, setDecision] = useState(null);
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  const crumbs = <Breadcrumb items={assessmentCrumbs(SECTIONS.rewards, 'Chi tiết đề xuất')} />;
  if (loading)
    return (
      <div className="page">
        {crumbs}
        <LoadingState />
      </div>
    );
  if (error)
    return (
      <div className="page">
        {crumbs}
        {[403, 404].includes(error.status) ? (
          <div className="card">
            <EmptyState icon={Lock} title="Không xem được đề xuất" description="Đề xuất không tồn tại hoặc nằm ngoài phạm vi của bạn." />
          </div>
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    );

  const p = detail.proposal;
  const name = (uid) => md.userById(uid)?.fullName || '—';
  const vpDone = !!p.vpReview && p.vpReview.decision === 'FORWARD';
  const steps = [
    {
      label: 'Giáo viên đề xuất',
      sub: p.submittedAt ? formatDateTime(p.submittedAt) : 'Bản nháp',
      done: !!p.submittedAt && p.status !== S.DRAFT,
    },
    {
      label: 'Phó hiệu trưởng xem xét',
      sub: p.vpReview ? `${name(p.vpReview.by)} · ${formatDateTime(p.vpReview.at)}` : '',
      done: vpDone,
      warn: p.status === S.RETURNED,
    },
    {
      label: 'Hiệu trưởng phê duyệt',
      sub: p.principalDecision ? `${name(p.principalDecision.by)} · ${formatDateTime(p.principalDecision.at)}` : '',
      done: p.status === S.APPROVED,
      warn: p.status === S.REJECTED,
    },
  ];

  const openDecision = (key) => {
    setDecision(key);
    setComment('');
    setCommentError('');
  };

  const doDecide = async () => {
    const cfg = DECISIONS[decision];
    const errors = validateDecision({ negative: cfg.negative, comment });
    if (errors.comment) {
      setCommentError(errors.comment);
      return;
    }
    try {
      if (decision === 'FORWARD' || decision === 'RETURN') await reviewRewardProposal(p.id, { decision, comment }, user);
      else await decideRewardProposal(p.id, { decision, comment }, user);
      toast.success('Quyết định đã được ghi nhận thành công.');
      setDecision(null);
      navigate('/assessment/rewards');
    } catch (err) {
      toast.error(err.message, 'Chưa ghi nhận được quyết định');
      setDecision(null);
      reload({ silent: true });
    }
  };

  const doDelete = async () => {
    try {
      await deleteRewardProposal(p.id, user);
      toast.success(`Đã xóa bản nháp ${p.code}.`);
      navigate('/assessment/rewards');
    } catch (err) {
      toast.error(err.message, 'Không xóa được bản nháp');
      setDeleteOpen(false);
    }
  };

  const review = canReviewRewardProposal(p, user);
  const decide = canDecideRewardProposal(p, user);
  const pendingNote =
    p.status === S.PENDING_VP
      ? 'Chờ Phó hiệu trưởng điểm trường xem xét'
      : p.status === S.PENDING_PRINCIPAL
        ? 'Chờ Hiệu trưởng phê duyệt'
        : null;

  return (
    <div className="page">
      {crumbs}
      <div className="page__head">
        <div>
          <h1 className="page__title" style={{ marginBottom: 6 }}>
            Đề xuất khen thưởng – {p.code}
          </h1>
          <RewardStatusBadge status={p.status} size="lg" />
        </div>
        <div className="row row--wrap" style={{ gap: 8, marginTop: 8 }}>
          {canDeleteRewardProposal(p, user) && (
            <button className="btn btn--outline-danger" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={16} /> Xóa bản nháp
            </button>
          )}
          {canEditRewardProposal(p, user) && (
            <Link className="btn btn--primary" to={`/assessment/rewards/${p.id}/edit`}>
              {p.status === S.RETURNED ? <Send size={16} /> : <Pencil size={16} />}{' '}
              {p.status === S.RETURNED ? 'Sửa và gửi lại' : 'Tiếp tục soạn'}
            </Link>
          )}
        </div>
      </div>

      <div className="card mt-16" style={{ padding: '20px 24px' }}>
        <ProgressSteps steps={steps} cancelled={p.status === S.REJECTED} />
      </div>

      {(review || decide) && (
        <div className="alert alert--purple mt-16">
          <AlertTriangle size={18} />
          <div>
            {review
              ? 'Đề xuất đang chờ bạn xem xét. Chuyển Hiệu trưởng nếu hợp lệ, hoặc trả lại giáo viên kèm lý do.'
              : 'Đề xuất đã được Phó hiệu trưởng xem xét và đang chờ bạn phê duyệt. Từ chối phải nêu lý do.'}
          </div>
        </div>
      )}
      {!review && !decide && pendingNote && (
        <div className="alert alert--info mt-16">
          <AlertTriangle size={18} />
          <div>{pendingNote}.</div>
        </div>
      )}
      {p.status === S.RETURNED && p.vpReview && (
        <div className="alert alert--danger mt-16">
          <Undo2 size={18} />
          <div>
            Bị trả lại bởi {name(p.vpReview.by)}: “{p.vpReview.comment}”
          </div>
        </div>
      )}
      {p.status === S.REJECTED && p.principalDecision && (
        <div className="alert alert--danger mt-16">
          <XCircle size={18} />
          <div>Hiệu trưởng từ chối: “{p.principalDecision.comment}”</div>
        </div>
      )}
      {p.status === S.APPROVED && (
        <div className="alert alert--success mt-16">
          <CheckCircle2 size={18} />
          <div>
            Đã phê duyệt ngày {formatDateTime(p.approvedAt)} bởi {name(p.approvedBy)}. Kết quả đã được công bố cho giáo viên, Phó hiệu
            trưởng và phụ huynh.
          </div>
        </div>
      )}

      <div className="split-2 mt-16">
        <div className="card">
          <div className="card__header">
            <div className="card__title">Thông tin đề xuất</div>
          </div>
          <div className="card__body">
            <dl className="info-list info-list--wide">
              <dt>Trẻ:</dt>
              <dd className="fw-600">
                {p.childName} <span className="muted">· {p.childCode}</span>
              </dd>
              <dt>Lớp:</dt>
              <dd>{p.className}</dd>
              <dt>Năm học:</dt>
              <dd>{p.schoolYear}</dd>
              <dt>Danh hiệu:</dt>
              <dd className="fw-600">{p.rewardTitle}</dd>
              <dt>Lý do:</dt>
              <dd className="dg-pre">{p.reason}</dd>
              <dt>Người đề xuất:</dt>
              <dd>{name(p.createdBy)}</dd>
              <dt>Phiếu bé ngoan:</dt>
              <dd>
                {detail.ticketCounts.weekly} phiếu tuần · {detail.ticketCounts.monthly} phiếu tháng
              </dd>
              {p.vpReview && (
                <>
                  <dt>Ý kiến Phó HT:</dt>
                  <dd>{p.vpReview.comment || '—'}</dd>
                </>
              )}
              {p.principalDecision && (
                <>
                  <dt>Ý kiến Hiệu trưởng:</dt>
                  <dd>{p.principalDecision.comment || '—'}</dd>
                </>
              )}
            </dl>
          </div>
        </div>
        <div className="card">
          <div className="card__header">
            <div className="card__title">
              <FileText size={18} /> Đánh giá cuối năm (căn cứ)
            </div>
          </div>
          <div className="card__body">
            {detail.yearEnd ? (
              <>
                <div className="dg-final text-sm">{detail.yearEnd.finalContent}</div>
                <div className="muted text-xs mt-8">
                  Xác nhận bởi {name(detail.yearEnd.confirmedBy)} · {formatDateTime(detail.yearEnd.confirmedAt)}
                </div>
              </>
            ) : (
              <div className="muted">Trẻ chưa có đánh giá cuối năm đã xác nhận.</div>
            )}
          </div>
        </div>
      </div>

      <div className="card mt-16">
        <div className="card__header">
          <div className="card__title">
            <History size={18} /> Lịch sử xử lý
          </div>
        </div>
        <div className="card__body">
          <ul className="history-list">
            {[...p.history].reverse().map((h) => (
              <li key={h.id}>
                <div className="history-list__dot" />
                <div>
                  <div>
                    <b>{REWARD_HISTORY_LABELS[h.action] || h.action}</b> · {name(h.userId)}
                  </div>
                  {h.note && <div className="text-2">“{h.note}”</div>}
                  <div className="muted text-xs">{formatDateTime(h.at)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="page-actions">
        <button className="btn" onClick={() => navigate('/assessment/rewards')}>
          <ArrowLeft size={16} /> Về danh sách
        </button>
        {review && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--outline-danger" onClick={() => openDecision('RETURN')}>
              <Undo2 size={16} /> Trả lại
            </button>
            <button className="btn btn--primary" onClick={() => openDecision('FORWARD')}>
              <Send size={16} /> Chuyển Hiệu trưởng
            </button>
          </div>
        )}
        {decide && (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn--outline-danger" onClick={() => openDecision('REJECT')}>
              <XCircle size={16} /> Từ chối
            </button>
            <button className="btn btn--primary" onClick={() => openDecision('APPROVE')}>
              <Check size={16} /> Phê duyệt
            </button>
          </div>
        )}
      </div>

      {decision && (
        <ConfirmationModal
          open
          title={DECISIONS[decision].title}
          message={DECISIONS[decision].msg}
          confirmLabel={DECISIONS[decision].label}
          danger={DECISIONS[decision].negative}
          onConfirm={doDecide}
          onClose={() => setDecision(null)}
        >
          <div className="field mt-12">
            <label className="field__label" htmlFor="dg-decision-comment">
              {DECISIONS[decision].negative ? 'Lý do' : 'Ý kiến (tùy chọn)'}
              {DECISIONS[decision].negative && <span className="req">*</span>}
            </label>
            <textarea
              id="dg-decision-comment"
              className={`textarea ${commentError ? 'textarea--error' : ''}`}
              rows={3}
              maxLength={500}
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setCommentError('');
              }}
            />
            {commentError && <span className="field__error">{commentError}</span>}
          </div>
        </ConfirmationModal>
      )}

      <ConfirmationModal
        open={deleteOpen}
        title={`Xóa bản nháp ${p.code}?`}
        message="Bản nháp sẽ bị xóa và không khôi phục được."
        confirmLabel="Xóa bản nháp"
        danger
        onConfirm={doDelete}
        onClose={() => setDeleteOpen(false)}
      />
    </div>
  );
}
