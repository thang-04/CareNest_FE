import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Forward, FilePlus2, Info, AlertTriangle } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useRequest } from '@/hooks/facility/useFacility';
import { approveRequest, rejectRequest, forwardRequest } from '@/services/facility/facilityService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { RequestStatusBadge, ProposalStatusBadge } from '@/components/facility/FacilityBadges';
import { FacilityHistoryCard } from '@/components/facility/FacilityHistoryCard';
import { DecisionModal } from '@/components/facility/DecisionModal';
import { locationLabel } from '@/models/Location';
import { ROLES } from '@/models/User';
import { REQUEST_STATUS, REQUEST_ITEM_MODES } from '@/models/facility/facilityConstants';
import { canReviewRequest, canPrincipalDecideRequest, canAddToProposal, isManager } from '@/utils/facility/facilityPermissions';
import { requestCrumbs, myReportCrumbs } from '@/utils/facility/breadcrumbs';
import { formatDateTime } from '@/utils/format';
import '@/styles/modules/facility.css';

const roleTitle = (role) => (role === ROLES.PRINCIPAL ? 'Hiệu trưởng' : 'Phó hiệu trưởng');

/** #119 Facility Request Detail (UC 7.3/7.4): VP approves, rejects or forwards; the Principal decides forwarded requests. */
export default function RequestDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const { request: r, loading, error, reload } = useRequest(id);
  const [modal, setModal] = useState(null);

  const crumbs = isManager(user) ? requestCrumbs : myReportCrumbs;
  if (loading || md.loading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (error || !r)
    return (
      <div className="page">
        <Breadcrumb items={crumbs('Chi tiết đề nghị')} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const name = (uid) => md.userById(uid)?.fullName || '—';
  const vpReview = canReviewRequest(r, user);
  const principalDecide = canPrincipalDecideRequest(r, user);
  const decided = [REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED].includes(r.status);
  const forwarded = !!r.forwardedAt;
  const loc = locationLabel(md.locationById(r.locationId));
  const backTo = isManager(user) ? '/facility/requests' : '/facility/my-reports?tab=requests';
  const what = `${r.quantity} ${r.unit.toLowerCase()} ${r.itemName}`;

  const steps = [
    { label: 'Gửi đề nghị', sub: `${name(r.requesterId)} · ${formatDateTime(r.createdAt)}`, done: true },
    {
      label: 'Phó hiệu trưởng xem xét',
      sub: forwarded
        ? `Chuyển Hiệu trưởng · ${formatDateTime(r.forwardedAt)}`
        : decided
          ? `${name(r.decidedBy)} · ${formatDateTime(r.decidedAt)}`
          : 'Đang chờ',
      done: forwarded || decided,
    },
    ...(forwarded
      ? [
          {
            label: 'Hiệu trưởng quyết định',
            sub: decided ? `${name(r.decidedBy)} · ${formatDateTime(r.decidedAt)}` : 'Đang chờ',
            done: decided,
          },
        ]
      : []),
    { label: r.status === REQUEST_STATUS.REJECTED ? 'Bị từ chối' : 'Đã duyệt', done: r.status === REQUEST_STATUS.APPROVED },
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
      <Breadcrumb items={crumbs(`Đề nghị ${r.code}`)} />
      <div className="page__head">
        <div>
          <h1 className="page__title" style={{ marginBottom: 6 }}>
            Đề nghị bổ sung {r.code}
          </h1>
          <RequestStatusBadge status={r.status} size="lg" />
        </div>
        <div className="row row--wrap" style={{ gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
          {(vpReview || principalDecide) && (
            <button className="btn btn--outline-danger" onClick={() => setModal('reject')}>
              <XCircle size={16} /> Từ chối
            </button>
          )}
          {vpReview && (
            <button className="btn" onClick={() => setModal('forward')}>
              <Forward size={16} /> Chuyển Hiệu trưởng
            </button>
          )}
          {(vpReview || principalDecide) && (
            <button className="btn btn--primary" onClick={() => setModal('approve')}>
              <CheckCircle2 size={16} /> Duyệt đề nghị
            </button>
          )}
          {canAddToProposal(r, user, () => r.proposal || undefined) && (
            <Link className="btn btn--primary" to={`/facility/proposals/new?requestId=${r.id}`}>
              <FilePlus2 size={16} /> Lập đề xuất mua sắm
            </Link>
          )}
        </div>
      </div>

      <div className="card mt-16" style={{ padding: '20px 24px' }}>
        <ProgressSteps steps={steps} cancelled={r.status === REQUEST_STATUS.REJECTED} />
      </div>

      {vpReview && (
        <div className="alert alert--purple mt-16">
          <Info size={18} />
          <div>
            Trong thẩm quyền của bạn: <b>Duyệt</b> hoặc <b>Từ chối</b> (bắt buộc lý do). Vượt thẩm quyền (ví dụ tài sản mới, giá trị lớn):
            chọn <b>Chuyển Hiệu trưởng</b>.
          </div>
        </div>
      )}
      {principalDecide && (
        <div className="alert alert--purple mt-16">
          <Info size={18} />
          <div>
            {name(r.forwardedBy)} đã chuyển đề nghị này vì vượt thẩm quyền của Phó hiệu trưởng
            {r.forwardNote ? `: “${r.forwardNote}”` : '.'} Người đề nghị và Phó hiệu trưởng sẽ nhận thông báo quyết định.
          </div>
        </div>
      )}
      {r.status === REQUEST_STATUS.REJECTED && (
        <div className="alert alert--danger mt-16">
          <AlertTriangle size={18} />
          <div>
            <b>{roleTitle(r.decidedByRole)} từ chối:</b> {r.rejectReason}
          </div>
        </div>
      )}

      <section className="card mt-16">
        <div className="card__header">
          <h2 className="card__title">Thông tin đề nghị</h2>
        </div>
        <div className="card__body">
          <div className="grid-2">
            <dl className="info-list info-list--wide">
              <dt>Tài sản:</dt>
              <dd className="fw-600">
                {r.itemName} {r.assetCode && <span className="muted">· {r.assetCode}</span>}
                {r.itemMode === REQUEST_ITEM_MODES.NEW && (
                  <span className="chip chip--blue" style={{ marginLeft: 6 }}>
                    Tài sản mới
                  </span>
                )}
              </dd>
              <dt>Nhóm:</dt>
              <dd>{md.categoryById(r.categoryId)?.name || '—'}</dd>
              <dt>Số lượng đề nghị:</dt>
              <dd className="fw-600">
                {r.quantity} {r.unit.toLowerCase()}
              </dd>
              <dt>Lớp/phòng:</dt>
              <dd>
                {loc} · {md.campusById(r.campusId)?.shortName}
              </dd>
            </dl>
            <dl className="info-list info-list--wide">
              <dt>Người đề nghị:</dt>
              <dd>{name(r.requesterId)}</dd>
              <dt>Thời gian gửi:</dt>
              <dd>{formatDateTime(r.createdAt)}</dd>
              <dt>Lý do:</dt>
              <dd style={{ whiteSpace: 'pre-line' }}>{r.reason}</dd>
              {forwarded && (
                <>
                  <dt>Chuyển Hiệu trưởng:</dt>
                  <dd>
                    {name(r.forwardedBy)} · {formatDateTime(r.forwardedAt)}
                    {r.forwardNote && <div className="text-2">“{r.forwardNote}”</div>}
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
      </section>

      {decided && (
        <section className="card mt-16">
          <div className="card__header">
            <h2 className="card__title">Kết quả</h2>
          </div>
          <div className="card__body">
            <dl className="info-list info-list--wide">
              <dt>Người quyết định:</dt>
              <dd>
                {name(r.decidedBy)} ({roleTitle(r.decidedByRole)}) · {formatDateTime(r.decidedAt)}
              </dd>
              <dt>{r.status === REQUEST_STATUS.APPROVED ? 'Ghi chú:' : 'Lý do từ chối:'}</dt>
              <dd>{(r.status === REQUEST_STATUS.APPROVED ? r.responseNote : r.rejectReason) || '—'}</dd>
              {r.status === REQUEST_STATUS.APPROVED && (
                <>
                  <dt>Đề xuất mua sắm:</dt>
                  <dd>
                    {r.proposal ? (
                      <span className="row" style={{ gap: 8 }}>
                        {isManager(user) ? (
                          <Link to={`/facility/proposals/${r.proposal.id}`} className="fw-600">
                            {r.proposal.code}
                          </Link>
                        ) : (
                          <b>{r.proposal.code}</b>
                        )}
                        <ProposalStatusBadge status={r.proposal.status} />
                      </span>
                    ) : (
                      <span className="muted">Chưa đưa vào đề xuất</span>
                    )}
                  </dd>
                </>
              )}
            </dl>
            <div className="muted text-sm mt-12">Việc mua sắm, thanh toán và nhận hàng thực hiện ngoài hệ thống (GBR-FAC-08).</div>
          </div>
        </section>
      )}

      <div className="mt-16">
        <FacilityHistoryCard history={r.history} userById={md.userById} />
      </div>

      <div className="page-actions">
        <button className="btn" onClick={() => navigate(backTo)}>
          <ArrowLeft size={16} /> Về danh sách
        </button>
      </div>

      <DecisionModal
        open={modal === 'approve'}
        title={`Duyệt đề nghị ${r.code}?`}
        message={`Duyệt bổ sung ${what} cho ${loc}. ${principalDecide ? 'Người đề nghị và Phó hiệu trưởng' : 'Người đề nghị'} sẽ nhận thông báo.`}
        confirmLabel="Duyệt đề nghị"
        noteLabel="Ghi chú"
        onConfirm={(note) => run(() => approveRequest(r.id, note, user), `Đã duyệt đề nghị ${r.code}`)}
        onClose={() => setModal(null)}
      />
      <DecisionModal
        open={modal === 'forward'}
        title={`Chuyển đề nghị ${r.code} cho Hiệu trưởng?`}
        message="Dùng khi đề nghị vượt thẩm quyền duyệt của Phó hiệu trưởng. Hiệu trưởng nhận thông báo và quyết định."
        confirmLabel="Chuyển Hiệu trưởng"
        noteLabel="Ý kiến của Phó hiệu trưởng"
        placeholder="Ví dụ: Thiết bị mới, giá trị lớn"
        onConfirm={(note) => run(() => forwardRequest(r.id, note, user), `Đã chuyển đề nghị ${r.code} cho Hiệu trưởng`)}
        onClose={() => setModal(null)}
      />
      <DecisionModal
        open={modal === 'reject'}
        title={`Từ chối đề nghị ${r.code}?`}
        message="Người đề nghị sẽ thấy lý do từ chối."
        confirmLabel="Từ chối đề nghị"
        danger
        required
        noteLabel="Lý do từ chối"
        onConfirm={(reason) => run(() => rejectRequest(r.id, reason, user), `Đã từ chối đề nghị ${r.code}`)}
        onClose={() => setModal(null)}
      />
    </div>
  );
}
