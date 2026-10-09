import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FileText, Lock, Save, Send, Undo2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useRewardCandidates, useRewardProposal } from '@/hooks/assessment/useAssessment';
import { saveRewardProposal } from '@/services/assessment/assessmentService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { EmptyState, ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { RewardStatusBadge } from '@/components/assessment/AssessmentBadges';
import { REWARD_STATUS, REWARD_STATUS_LABELS, REWARD_TITLES } from '@/models/assessment/assessmentConstants';
import { formatDateTime } from '@/utils/format';
import { canCreateRewardProposal, canEditRewardProposal } from '@/utils/assessment/assessmentPermissions';
import { validateRewardProposal, hasErrors } from '@/utils/assessment/assessmentValidation';
import { assessmentCrumbs, SECTIONS } from '@/utils/assessment/breadcrumbs';
import '@/styles/modules/assessment.css';

const EMPTY = { classId: '', childId: '', rewardTitle: '', reason: '' };

/** #62 Reward Proposal Form (UC 4.12): the teacher proposes a year-end reward from a confirmed year-end evaluation. */
export default function RewardProposalFormPage() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { schoolYear: headerYear } = useSchoolYear();
  const { detail, loading: pLoading, error: pError } = useRewardProposal(id, { live: false });
  const proposal = detail?.proposal || null;
  const schoolYear = proposal?.schoolYear || headerYear;
  const { groups, loading: cLoading, error: cError, reload } = useRewardCandidates(schoolYear);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Prefill once: from the proposal being edited, or from ?classId=&childId= (link on the year-end evaluation).
  useEffect(() => {
    if (proposal)
      setForm({ classId: proposal.classId, childId: proposal.childId, rewardTitle: proposal.rewardTitle, reason: proposal.reason });
    else if (!id && groups.length)
      setForm((f) =>
        f.classId
          ? f
          : {
              ...f,
              classId:
                search.get('classId') && groups.some((g) => g.cls.id === search.get('classId')) ? search.get('classId') : groups[0].cls.id,
              childId: search.get('childId') || '',
            },
      );
  }, [proposal, id, groups, search]);

  const group = groups.find((g) => g.cls.id === form.classId);
  const candidate = group?.children.find((c) => c.child.id === form.childId) || null;
  const otherProposals = useMemo(() => (candidate?.proposals || []).filter((p) => p.id !== id), [candidate, id]);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value, ...(field === 'classId' ? { childId: '' } : {}) }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };
  const blur = (field) => {
    const e = validateRewardProposal(form);
    if (form[field] && e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };

  if (pLoading || cLoading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  const loadError = pError || cError;
  const blocked = !canCreateRewardProposal(user) || (id && proposal && !canEditRewardProposal(proposal, user));
  if (loadError || blocked)
    return (
      <div className="page">
        <Breadcrumb items={assessmentCrumbs(SECTIONS.rewards, id ? 'Sửa đề xuất' : 'Tạo đề xuất')} />
        {loadError && ![403, 404].includes(loadError.status) ? (
          <ErrorState error={loadError} onRetry={reload} />
        ) : (
          <div className="card">
            <EmptyState
              icon={Lock}
              title="Không sửa được đề xuất"
              description="Chỉ giáo viên tạo đề xuất mới sửa được, và chỉ khi đề xuất đang là bản nháp hoặc bị trả lại."
              action={
                <Link className="btn" to={id ? `/assessment/rewards/${id}` : '/assessment/rewards'}>
                  <ArrowLeft size={16} /> Quay lại
                </Link>
              }
            />
          </div>
        )}
      </div>
    );

  const submit = async (send) => {
    const e = validateRewardProposal(form);
    if (send && candidate && !candidate.yearEnd) e.childId = 'Trẻ chưa có đánh giá cuối năm đã xác nhận.';
    setErrors(e);
    if (hasErrors(e)) {
      setConfirmOpen(false);
      toast.error('Vui lòng kiểm tra các trường được đánh dấu.', 'Chưa lưu được');
      return;
    }
    setBusy(send ? 'send' : 'save');
    try {
      const saved = await saveRewardProposal(id || null, { ...form, schoolYear }, { submit: send }, user);
      toast.success(send ? 'Đã tạo đề xuất khen thưởng cuối năm thành công.' : 'Đã lưu bản nháp.');
      navigate(send ? `/assessment/rewards/${saved.id}` : `/assessment/rewards/${saved.id}/edit`, { replace: true });
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được đề xuất');
    } finally {
      setBusy('');
      setConfirmOpen(false);
    }
  };

  const title = id ? `Sửa đề xuất ${proposal?.code || ''}` : 'Tạo đề xuất khen thưởng';

  return (
    <div className="page">
      <Breadcrumb items={assessmentCrumbs(SECTIONS.rewards, id ? 'Sửa đề xuất' : 'Tạo đề xuất')} />
      <div className="page__head">
        <h1 className="page__title" style={{ marginBottom: 6 }}>
          {title}
        </h1>
        {proposal && <RewardStatusBadge status={proposal.status} size="lg" />}
      </div>

      {proposal?.status === REWARD_STATUS.RETURNED && proposal.vpReview && (
        <div className="alert alert--danger mb-16">
          <Undo2 size={18} />
          <div>
            <div className="fw-600">Phó hiệu trưởng trả lại đề xuất · {formatDateTime(proposal.vpReview.at)}</div>
            <div className="mt-8">Lý do: “{proposal.vpReview.comment}”</div>
          </div>
        </div>
      )}
      {groups.length === 0 && (
        <div className="alert alert--warning mb-16">
          <AlertTriangle size={18} />
          <div>Bạn chưa được phân công lớp nào nên chưa thể tạo đề xuất.</div>
        </div>
      )}

      <div className="split-2">
        <div className="card wizard-card">
          <div className="card__header">
            <div className="card__title">Thông tin đề xuất · Năm học {schoolYear}</div>
          </div>
          <div className="card__body stack">
            <FormField label="Lớp" required error={errors.classId}>
              <select className="select" value={form.classId} onChange={(e) => set('classId', e.target.value)}>
                <option value="">Chọn lớp</option>
                {groups.map((g) => (
                  <option key={g.cls.id} value={g.cls.id}>
                    {g.cls.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Trẻ được đề xuất"
              required
              error={errors.childId}
              hint="Chỉ trẻ có đánh giá cuối năm đã xác nhận mới gửi đề xuất được."
            >
              <select className="select" value={form.childId} onChange={(e) => set('childId', e.target.value)} disabled={!group}>
                <option value="">Chọn trẻ</option>
                {(group?.children || []).map((c) => (
                  <option key={c.child.id} value={c.child.id}>
                    {c.child.fullName}
                    {c.yearEnd ? '' : ' – chưa có đánh giá cuối năm đã xác nhận'}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Danh hiệu khen thưởng" required error={errors.rewardTitle}>
              <select
                className="select"
                value={form.rewardTitle}
                onChange={(e) => set('rewardTitle', e.target.value)}
                onBlur={() => blur('rewardTitle')}
              >
                <option value="">Chọn danh hiệu</option>
                {REWARD_TITLES.map((t) => (
                  <option key={t} value={t} disabled={otherProposals.some((p) => p.rewardTitle === t)}>
                    {t}
                    {otherProposals.some((p) => p.rewardTitle === t) ? ' (đã đề xuất)' : ''}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Lý do đề xuất"
              required
              error={errors.reason}
              hint="Nêu căn cứ từ đánh giá cuối năm, phiếu bé ngoan… (20–1000 ký tự)."
            >
              <textarea
                className="textarea"
                rows={6}
                maxLength={1000}
                value={form.reason}
                onChange={(e) => set('reason', e.target.value)}
                onBlur={() => blur('reason')}
              />
            </FormField>
          </div>
        </div>

        <div className="card">
          <div className="card__header">
            <div className="card__title">
              <FileText size={18} /> Đánh giá cuối năm của trẻ
            </div>
          </div>
          <div className="card__body">
            {!candidate ? (
              <div className="muted">Chọn trẻ để xem đánh giá cuối năm đã xác nhận.</div>
            ) : candidate.yearEnd ? (
              <>
                <div className="dg-final text-sm">{candidate.yearEnd.finalContent}</div>
                <div className="muted text-xs mt-8">Xác nhận {formatDateTime(candidate.yearEnd.confirmedAt)}</div>
              </>
            ) : (
              <div className="alert alert--warning">
                <AlertTriangle size={18} />
                <div>
                  Thiếu dữ liệu nguồn: trẻ chưa có đánh giá cuối năm đã xác nhận. Hãy{' '}
                  <Link to="/assessment/year-end">xác nhận đánh giá cuối năm</Link> trước khi gửi đề xuất.
                </div>
              </div>
            )}
            {otherProposals.length > 0 && (
              <div className="mt-16">
                <div className="subsection-title">Đề xuất khác của trẻ trong năm học</div>
                <ul className="stack" style={{ margin: 0, paddingLeft: 18 }}>
                  {otherProposals.map((p) => (
                    <li key={p.id} className="text-sm">
                      {p.rewardTitle} – {REWARD_STATUS_LABELS[p.status]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="page-actions">
        <button className="btn" onClick={() => navigate(id ? `/assessment/rewards/${id}` : '/assessment/rewards')} disabled={!!busy}>
          <ArrowLeft size={16} /> Hủy
        </button>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => submit(false)} disabled={!!busy || !groups.length}>
            {busy === 'save' ? <Spinner small /> : <Save size={16} />} Lưu nháp
          </button>
          <button
            className="btn btn--primary"
            disabled={!!busy || !groups.length}
            onClick={() => {
              const e = validateRewardProposal(form);
              if (candidate && !candidate.yearEnd) e.childId = 'Trẻ chưa có đánh giá cuối năm đã xác nhận.';
              setErrors(e);
              if (!hasErrors(e)) setConfirmOpen(true);
            }}
          >
            <Send size={16} /> {proposal?.status === REWARD_STATUS.RETURNED ? 'Gửi lại đề xuất' : 'Gửi đề xuất'}
          </button>
        </div>
      </div>

      <ConfirmationModal
        open={confirmOpen}
        title="Gửi đề xuất khen thưởng?"
        message="Đề xuất sẽ được gửi Phó hiệu trưởng xem xét, sau đó Hiệu trưởng phê duyệt. Trong lúc chờ duyệt bạn không sửa được đề xuất."
        confirmLabel="Gửi đề xuất"
        onConfirm={() => submit(true)}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
