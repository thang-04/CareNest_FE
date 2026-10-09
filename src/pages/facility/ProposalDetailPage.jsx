import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Pencil, Info, AlertTriangle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useProposal } from '@/hooks/facility/useFacility';
import { approveProposal, rejectProposal, cancelProposal } from '@/services/facility/facilityService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ProposalStatusBadge } from '@/components/facility/FacilityBadges';
import { FacilityHistoryCard } from '@/components/facility/FacilityHistoryCard';
import { DecisionModal } from '@/components/facility/DecisionModal';
import { locationLabel } from '@/models/Location';
import { PROPOSAL_STATUS, PROPOSAL_ACTION_LABELS, SOURCE_TYPES, SOURCE_TYPE_LABELS } from '@/models/facility/facilityConstants';
import { canDecideProposal, canEditProposal, canCancelProposal } from '@/utils/facility/facilityPermissions';
import { proposalCrumbs } from '@/utils/facility/breadcrumbs';
import { formatMoney, proposalTotal } from '@/utils/facility/facilityFormat';
import { formatDateTime } from '@/utils/format';
import '@/styles/modules/facility.css';

const sourceLink = (l) =>
  l.sourceType === SOURCE_TYPES.ISSUE
    ? `/facility/issues/${l.sourceId}`
    : l.sourceType === SOURCE_TYPES.REQUEST
      ? `/facility/requests/${l.sourceId}`
      : null;

/** Proposal detail: the Principal approves or rejects (reason required); the VP follows, edits drafts or cancels (GBR-FAC-10). */
export default function ProposalDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const { proposal: p, loading, error, reload } = useProposal(id);
  const [modal, setModal] = useState(null);

  if (loading || md.loading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (error || !p)
    return (
      <div className="page">
        <Breadcrumb items={proposalCrumbs('Chi tiết đề xuất')} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const name = (uid) => md.userById(uid)?.fullName || '—';
  const decide = canDecideProposal(p, user);
  const decided = [PROPOSAL_STATUS.APPROVED, PROPOSAL_STATUS.REJECTED].includes(p.status);
  const total = proposalTotal(p.lines);

  const steps = [
    { label: 'Lập đề xuất', sub: `${name(p.createdBy)} · ${formatDateTime(p.createdAt)}`, done: true },
    { label: 'Gửi Hiệu trưởng', sub: p.submittedAt ? formatDateTime(p.submittedAt) : 'Bản nháp', done: !!p.submittedAt },
    {
      label: p.status === PROPOSAL_STATUS.REJECTED ? 'Bị từ chối' : 'Hiệu trưởng phê duyệt',
      sub: decided ? `${name(p.decidedBy)} · ${formatDateTime(p.decidedAt)}` : undefined,
      done: p.status === PROPOSAL_STATUS.APPROVED,
    },
  ];

  const run = async (fn, okMessage) => {
    try {
      await fn();
      toast.success(okMessage);
      setModal(null);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message, 'Không thực hiện được');
      throw err;
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={proposalCrumbs(`Đề xuất ${p.code}`)} />
      <div className="page__head">
        <div>
          <h1 className="page__title" style={{ marginBottom: 6 }}>
            Đề xuất {p.code}
          </h1>
          <ProposalStatusBadge status={p.status} size="lg" />
        </div>
        <div className="row row--wrap" style={{ gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
          {canCancelProposal(p, user) && (
            <button className="btn btn--outline-danger" onClick={() => setModal('cancel')}>
              <XCircle size={16} /> Hủy đề xuất
            </button>
          )}
          {canEditProposal(p, user) && (
            <Link className="btn btn--primary" to={`/facility/proposals/${p.id}/edit`}>
              <Pencil size={16} /> Tiếp tục soạn
            </Link>
          )}
          {decide && (
            <>
              <button className="btn btn--outline-danger" onClick={() => setModal('reject')}>
                <XCircle size={16} /> Từ chối
              </button>
              <button className="btn btn--primary" onClick={() => setModal('approve')}>
                <CheckCircle2 size={16} /> Phê duyệt
              </button>
            </>
          )}
        </div>
      </div>

      <div className="card mt-16" style={{ padding: '20px 24px' }}>
        <ProgressSteps steps={steps} cancelled={[PROPOSAL_STATUS.REJECTED, PROPOSAL_STATUS.CANCELLED].includes(p.status)} />
      </div>

      {decide && (
        <div className="alert alert--purple mt-16">
          <Info size={18} />
          <div>
            Xem danh sách tài sản và dự toán. <b>Phê duyệt</b> hoặc <b>Từ chối</b> (bắt buộc lý do); Phó hiệu trưởng và người báo nhận thông
            báo. Mua sắm, thanh toán thực hiện ngoài hệ thống.
          </div>
        </div>
      )}
      {p.status === PROPOSAL_STATUS.REJECTED && (
        <div className="alert alert--danger mt-16">
          <AlertTriangle size={18} />
          <div>
            <b>Lý do từ chối:</b> {p.rejectReason}. Các báo cáo/đề nghị trong đề xuất được trả lại để lập đề xuất mới.
          </div>
        </div>
      )}
      {p.status === PROPOSAL_STATUS.CANCELLED && (
        <div className="alert alert--warning mt-16">
          <AlertTriangle size={18} />
          <div>
            <b>Đã hủy:</b> {p.cancelReason}
          </div>
        </div>
      )}
      {p.status === PROPOSAL_STATUS.APPROVED && (
        <div className="alert alert--success mt-16">
          <CheckCircle2 size={18} />
          <div>
            Hiệu trưởng {name(p.decidedBy)} đã phê duyệt ({formatDateTime(p.decidedAt)}){p.decisionNote ? `: “${p.decisionNote}”` : '.'}
          </div>
        </div>
      )}

      <div className="detail-layout mt-16">
        <div className="detail-layout__main">
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Thông tin đề xuất</h2>
            </div>
            <div className="card__body">
              <div className="grid-2">
                <dl className="info-list info-list--wide">
                  <dt>Tên đề xuất:</dt>
                  <dd className="fw-600">{p.title}</dd>
                  <dt>Hình thức:</dt>
                  <dd>{PROPOSAL_ACTION_LABELS[p.action]}</dd>
                  <dt>Campus:</dt>
                  <dd>{md.campusById(p.campusId)?.shortName}</dd>
                </dl>
                <dl className="info-list info-list--wide">
                  <dt>Người lập:</dt>
                  <dd>{name(p.createdBy)} (Phó hiệu trưởng)</dd>
                  <dt>Lý do / căn cứ:</dt>
                  <dd style={{ whiteSpace: 'pre-line' }}>{p.reason || '—'}</dd>
                </dl>
              </div>
            </div>
          </section>

          <section className="card mt-16">
            <div className="card__header">
              <h2 className="card__title">Tài sản đề xuất ({p.lines.length})</h2>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nguồn</th>
                    <th>Tài sản</th>
                    <th>Lớp/phòng</th>
                    <th className="right">Số lượng</th>
                    <th className="right">Dự toán</th>
                    <th>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {p.lines.map((l, idx) => {
                    const link = sourceLink(l);
                    return (
                      <tr key={l.id}>
                        <td>{idx + 1}</td>
                        <td className="nowrap">
                          {link ? (
                            <Link to={link} title={SOURCE_TYPE_LABELS[l.sourceType]} className="fw-600">
                              {l.sourceCode}
                            </Link>
                          ) : (
                            <span className="chip chip--gray">{SOURCE_TYPE_LABELS.MANUAL}</span>
                          )}
                        </td>
                        <td className="bh-cell-wrap fw-600">{l.itemName}</td>
                        <td>
                          {l.locationId ? locationLabel(md.locationById(l.locationId)) : <span className="muted">Dùng chung campus</span>}
                        </td>
                        <td className="right nowrap">
                          {l.quantity} <span className="muted">{l.unit}</span>
                        </td>
                        <td className="right nowrap">{formatMoney(l.estimatedCost)}</td>
                        <td className="bh-cell-wrap text-sm">{l.note || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="bh-total">
              <span>Tổng dự toán:</span>
              <span>{formatMoney(total)}</span>
            </div>
          </section>
        </div>
        <aside className="detail-layout__aside">
          <FacilityHistoryCard history={p.history} userById={md.userById} />
        </aside>
      </div>

      <div className="page-actions">
        <button className="btn" onClick={() => navigate('/facility/proposals')}>
          <ArrowLeft size={16} /> Về danh sách
        </button>
      </div>

      <DecisionModal
        open={modal === 'approve'}
        title={`Phê duyệt đề xuất ${p.code}?`}
        message={`${PROPOSAL_ACTION_LABELS[p.action]}: ${p.title} – ${p.lines.length} tài sản, tổng dự toán ${formatMoney(total)}.`}
        confirmLabel="Phê duyệt đề xuất"
        noteLabel="Ý kiến chỉ đạo"
        onConfirm={(note) => run(() => approveProposal(p.id, note, user), `Đã phê duyệt đề xuất ${p.code}`)}
        onClose={() => setModal(null)}
      />
      <DecisionModal
        open={modal === 'reject'}
        title={`Từ chối đề xuất ${p.code}?`}
        message="Phó hiệu trưởng sẽ thấy lý do; các báo cáo/đề nghị trong đề xuất được trả lại để lập đề xuất mới."
        confirmLabel="Từ chối đề xuất"
        danger
        required
        noteLabel="Lý do từ chối"
        onConfirm={(reason) => run(() => rejectProposal(p.id, reason, user), `Đã từ chối đề xuất ${p.code}`)}
        onClose={() => setModal(null)}
      />
      <DecisionModal
        open={modal === 'cancel'}
        title={`Hủy đề xuất ${p.code}?`}
        message={
          p.status === PROPOSAL_STATUS.SUBMITTED
            ? 'Hiệu trưởng sẽ nhận thông báo đề xuất đã bị hủy. Các báo cáo/đề nghị trong đề xuất được trả lại.'
            : 'Các báo cáo/đề nghị trong bản nháp được trả lại để lập đề xuất khác.'
        }
        confirmLabel="Hủy đề xuất"
        danger
        required
        noteLabel="Lý do hủy"
        onConfirm={(reason) => run(() => cancelProposal(p.id, reason, user), `Đã hủy đề xuất ${p.code}`)}
        onClose={() => setModal(null)}
      />
    </div>
  );
}
