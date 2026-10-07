import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, FilePlus2, Lock, Info, AlertTriangle, ArrowRight, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useIssue } from '@/hooks/facility/useFacility';
import { approveIssue, rejectIssue } from '@/services/facility/facilityService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ConditionBadge } from '@/components/asset/AssetVisuals';
import { IssueStatusBadge, IssueTypeChip, LockChip, ProposalStatusBadge } from '@/components/facility/FacilityBadges';
import { FacilityHistoryCard } from '@/components/facility/FacilityHistoryCard';
import { DecisionModal } from '@/components/facility/DecisionModal';
import { PhotoGallery } from '@/components/facility/PhotoGallery';
import { locationLabel } from '@/models/Location';
import { ASSET_CONDITION_LABELS } from '@/models/Asset';
import { ISSUE_STATUS, ISSUE_TYPES } from '@/models/facility/facilityConstants';
import { canDecideIssue, canAddToProposal, isManager } from '@/utils/facility/facilityPermissions';
import { issueCrumbs, myReportCrumbs } from '@/utils/facility/breadcrumbs';
import { formatDateTime } from '@/utils/format';
import '@/styles/modules/facility.css';

const DAMAGE_CONDITIONS = ['NEED_REPAIR', 'BROKEN'];

/** Change written to the facility list on approval (GBR-FAC-07). */
function AssetChange({ change, unit }) {
  if (!change) return <span className="muted">Không thay đổi danh sách tài sản (báo thiếu số lượng).</span>;
  if (change.kind === 'QUANTITY')
    return (
      <span className="bh-change">
        Số lượng: <b>{change.fromQuantity}</b> <ArrowRight size={14} /> <b>{change.toQuantity}</b> {unit.toLowerCase()} (giảm{' '}
        {change.quantity})
      </span>
    );
  return (
    <span className="bh-change">
      {change.quantity} {unit.toLowerCase()}: <ConditionBadge value={change.fromCondition} /> <ArrowRight size={14} />{' '}
      <ConditionBadge value={change.toCondition} />
    </span>
  );
}

/** #118 Facility Issue Detail: the VP approves or rejects a report (GBR-FAC-05..07); the Principal and the reporter view it. */
export default function IssueDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const { issue: i, loading, error, reload } = useIssue(id);
  const [modal, setModal] = useState(null);
  const [newCondition, setNewCondition] = useState('NEED_REPAIR');

  const crumbs = isManager(user) ? issueCrumbs : myReportCrumbs;
  if (loading || md.loading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (error || !i)
    return (
      <div className="page">
        <Breadcrumb items={crumbs('Chi tiết báo cáo')} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  const name = (uid) => md.userById(uid)?.fullName || '—';
  const decide = canDecideIssue(i, user);
  const blockedByLock = decide && i.lockedBy && i.type !== ISSUE_TYPES.INSUFFICIENT;
  const decided = i.status !== ISSUE_STATUS.SUBMITTED;
  const loc = locationLabel(md.locationById(i.locationId));
  const backTo = isManager(user) ? '/facility/issues' : '/facility/my-reports';

  const steps = [
    { label: 'Gửi báo cáo', sub: `${name(i.reporterId)} · ${formatDateTime(i.createdAt)}`, done: true },
    {
      label: 'Phó hiệu trưởng xét duyệt',
      sub: decided ? `${name(i.decidedBy)} · ${formatDateTime(i.decidedAt)}` : 'Đang chờ',
      done: decided,
    },
    {
      label: i.status === ISSUE_STATUS.REJECTED ? 'Bị từ chối' : 'Cập nhật danh sách tài sản',
      sub: i.status === ISSUE_STATUS.APPROVED ? 'Đã cập nhật' : undefined,
      done: i.status === ISSUE_STATUS.APPROVED,
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
      <Breadcrumb items={crumbs(`Báo cáo ${i.code}`)} />
      <div className="page__head">
        <div>
          <h1 className="page__title" style={{ marginBottom: 6 }}>
            Báo cáo sự cố {i.code}
          </h1>
          <IssueStatusBadge status={i.status} size="lg" />
        </div>
        <div className="row row--wrap" style={{ gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
          {decide && (
            <>
              <button className="btn btn--outline-danger" onClick={() => setModal('reject')}>
                <XCircle size={16} /> Từ chối
              </button>
              <button
                className="btn btn--primary"
                disabled={!!blockedByLock}
                onClick={() => {
                  setNewCondition('NEED_REPAIR');
                  setModal('approve');
                }}
              >
                <CheckCircle2 size={16} /> Duyệt báo cáo
              </button>
            </>
          )}
          {canAddToProposal(i, user, () => i.proposal || undefined) && (
            <Link className="btn btn--primary" to={`/facility/proposals/new?issueId=${i.id}`}>
              <FilePlus2 size={16} /> Lập đề xuất xử lý
            </Link>
          )}
        </div>
      </div>

      <div className="card mt-16" style={{ padding: '20px 24px' }}>
        <ProgressSteps steps={steps} cancelled={i.status === ISSUE_STATUS.REJECTED} />
      </div>

      {blockedByLock && (
        <div className="alert alert--warning mt-16">
          <Lock size={18} />
          <div>
            {loc} đang kiểm kê (<b>{i.lockedBy}</b>), dữ liệu tài sản tạm khóa. Bạn có thể từ chối ngay, còn duyệt (cập nhật tình trạng)
            thực hiện sau khi đợt kiểm kê hoàn tất.
          </div>
        </div>
      )}
      {decide && !blockedByLock && (
        <div className="alert alert--purple mt-16">
          <Info size={18} />
          <div>
            Kiểm tra mô tả và ảnh. <b>Duyệt</b> sẽ cập nhật tình trạng/số lượng trong danh sách tài sản; <b>Từ chối</b> giữ nguyên danh sách
            và bắt buộc nêu lý do. Người báo nhận thông báo kết quả.
          </div>
        </div>
      )}
      {!decided && !decide && (
        <div className="alert alert--info mt-16">
          <Info size={18} />
          <div>Báo cáo đang chờ Phó hiệu trưởng phụ trách campus xét duyệt.</div>
        </div>
      )}
      {i.status === ISSUE_STATUS.REJECTED && (
        <div className="alert alert--danger mt-16">
          <AlertTriangle size={18} />
          <div>
            <b>Lý do từ chối:</b> {i.rejectReason}
          </div>
        </div>
      )}

      <section className="card mt-16">
        <div className="card__header">
          <h2 className="card__title">Thông tin sự cố</h2>
        </div>
        <div className="card__body">
          <div className="grid-2">
            <dl className="info-list info-list--wide">
              <dt>Tài sản:</dt>
              <dd className="fw-600">
                {i.assetName} <span className="muted">· {i.assetCode}</span>
              </dd>
              <dt>Lớp/phòng:</dt>
              <dd>
                {loc} · {md.campusById(i.campusId)?.shortName}
                {i.lockedBy && !decided && (
                  <span style={{ marginLeft: 8 }}>
                    <LockChip code={i.lockedBy} />
                  </span>
                )}
              </dd>
              <dt>Loại sự cố:</dt>
              <dd>
                <IssueTypeChip type={i.type} />
              </dd>
              <dt>Số lượng:</dt>
              <dd>
                {i.type === ISSUE_TYPES.INSUFFICIENT
                  ? `Hiện có ${i.currentQuantity}, cần bổ sung ${i.quantity} ${i.unit.toLowerCase()}`
                  : `${i.quantity} ${i.unit.toLowerCase()} ${i.type === ISSUE_TYPES.MISSING ? 'bị mất' : 'bị hỏng'}`}
              </dd>
            </dl>
            <dl className="info-list info-list--wide">
              <dt>Người báo:</dt>
              <dd>{name(i.reporterId)}</dd>
              <dt>Thời gian gửi:</dt>
              <dd>{formatDateTime(i.createdAt)}</dd>
              <dt>Mô tả:</dt>
              <dd style={{ whiteSpace: 'pre-line' }}>{i.description}</dd>
            </dl>
          </div>
          <div className="subsection-title mt-16 mb-8">Ảnh hiện trạng</div>
          <PhotoGallery images={i.images} title={`Ảnh ${i.assetName}`} />
        </div>
      </section>

      {i.linkedReports.length > 0 && (
        <section className="card mt-16">
          <div className="card__header">
            <h2 className="card__title row" style={{ gap: 8 }}>
              <Users size={17} /> Người báo trùng ({i.linkedReports.length})
            </h2>
          </div>
          <div className="card__body stack" style={{ gap: 8 }}>
            {i.linkedReports.map((r) => (
              <div key={`${r.userId}_${r.at}`}>
                <b>{name(r.userId)}</b> <span className="muted text-xs">· {formatDateTime(r.at)}</span>
                <div className="text-2">“{r.description}”</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {decided && (
        <section className="card mt-16">
          <div className="card__header">
            <h2 className="card__title">Kết quả xử lý</h2>
          </div>
          <div className="card__body">
            <dl className="info-list info-list--wide">
              <dt>Người duyệt:</dt>
              <dd>
                {name(i.decidedBy)} · {formatDateTime(i.decidedAt)}
              </dd>
              <dt>Quyết định:</dt>
              <dd>
                <IssueStatusBadge status={i.status} />
              </dd>
              {i.status === ISSUE_STATUS.APPROVED ? (
                <>
                  <dt>Phản hồi:</dt>
                  <dd>{i.responseNote || '—'}</dd>
                  <dt>Danh sách tài sản:</dt>
                  <dd>
                    <AssetChange change={i.assetChange} unit={i.unit} />
                  </dd>
                  <dt>Đề xuất xử lý:</dt>
                  <dd>
                    {i.proposal ? (
                      <span className="row" style={{ gap: 8 }}>
                        {isManager(user) ? (
                          <Link to={`/facility/proposals/${i.proposal.id}`} className="fw-600">
                            {i.proposal.code}
                          </Link>
                        ) : (
                          <b>{i.proposal.code}</b>
                        )}
                        <ProposalStatusBadge status={i.proposal.status} />
                      </span>
                    ) : (
                      <span className="muted">Chưa lập đề xuất</span>
                    )}
                  </dd>
                </>
              ) : (
                <>
                  <dt>Lý do từ chối:</dt>
                  <dd>{i.rejectReason}</dd>
                </>
              )}
            </dl>
          </div>
        </section>
      )}

      <div className="mt-16">
        <FacilityHistoryCard history={i.history} userById={md.userById} />
      </div>

      <div className="page-actions">
        <button className="btn" onClick={() => navigate(backTo)}>
          <ArrowLeft size={16} /> Về danh sách
        </button>
      </div>

      <DecisionModal
        open={modal === 'approve'}
        title={`Duyệt báo cáo ${i.code}?`}
        message={`${i.assetName} – ${loc}. Người báo sẽ nhận thông báo kết quả.`}
        confirmLabel="Duyệt báo cáo"
        noteLabel="Phản hồi cho người báo"
        placeholder="Ví dụ: Đã liên hệ thợ sửa trong tuần này"
        onConfirm={(note) => run(() => approveIssue(i.id, { note, newCondition }, user), `Đã duyệt báo cáo ${i.code}`)}
        onClose={() => setModal(null)}
      >
        {i.type === ISSUE_TYPES.DAMAGED && (
          <div className="field mt-12">
            <span className="field__label" id="bh-new-cond">
              Tình trạng mới của {i.quantity} {i.unit.toLowerCase()}
              <span className="req">*</span>
            </span>
            <div className="row" style={{ gap: 16 }} role="radiogroup" aria-labelledby="bh-new-cond">
              {DAMAGE_CONDITIONS.map((c) => (
                <label key={c} className="radio">
                  <input type="radio" name="bh-new-cond" checked={newCondition === c} onChange={() => setNewCondition(c)} />{' '}
                  {ASSET_CONDITION_LABELS[c]}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="text-sm text-2 mt-12">
          {i.type === ISSUE_TYPES.DAMAGED &&
            `Danh sách tài sản: ${i.quantity} ${i.unit.toLowerCase()} chuyển sang "${ASSET_CONDITION_LABELS[newCondition]}".`}
          {i.type === ISSUE_TYPES.MISSING && `Danh sách tài sản: số lượng giảm ${i.quantity} ${i.unit.toLowerCase()}.`}
          {i.type === ISSUE_TYPES.INSUFFICIENT && 'Danh sách tài sản không thay đổi; bạn có thể lập đề xuất mua bổ sung gửi Hiệu trưởng.'}
        </div>
      </DecisionModal>

      <DecisionModal
        open={modal === 'reject'}
        title={`Từ chối báo cáo ${i.code}?`}
        message="Danh sách tài sản giữ nguyên. Người báo sẽ thấy lý do từ chối."
        confirmLabel="Từ chối báo cáo"
        danger
        required
        noteLabel="Lý do từ chối"
        placeholder="Ví dụ: Tài sản đang được mượn sang phòng khác, không bị mất"
        onConfirm={(reason) => run(() => rejectIssue(i.id, reason, user), `Đã từ chối báo cáo ${i.code}`)}
        onClose={() => setModal(null)}
      />
    </div>
  );
}
