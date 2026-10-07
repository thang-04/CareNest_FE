import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Printer,
  FileSearch,
  Pencil,
  Scale,
  XCircle,
  ArrowLeft,
  AlertTriangle,
  Handshake,
  PackageCheck,
  History,
  CheckCircle2,
  ShieldOff,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTransfer } from '@/hooks/facility-transfer/useTransfers';
import { useMasterData } from '@/hooks/useMasterData';
import { cancelTransfer } from '@/services/facility-transfer/transferService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Avatar } from '@/components/ui/Avatar';
import { TransferStatusBadge } from '@/components/facility-transfer/TransferStatusBadge';
import { TransferTimeline } from '@/components/facility-transfer/TransferTimeline';
import { TransferAssetTable } from '@/components/facility-transfer/TransferAssetTable';
import { PrintPreview } from '@/components/facility-transfer/PrintPreview';
import { TransferSignaturesCard } from '@/components/facility-transfer/TransferSignaturesCard';
import { StockMovementCard } from '@/components/facility-transfer/StockMovementCard';
import { DiscrepancyHistoryCard, decisionText } from '@/components/facility-transfer/DiscrepancyHistoryCard';
import { FileUploader } from '@/components/upload/FileUploader';
import { buildPrintModel } from '@/utils/facility-transfer/printModel';
import { formatDate, formatDateTime } from '@/utils/format';
import { ROLE_LABELS } from '@/models/User';
import { locationLabel } from '@/models/Location';
import {
  TRANSFER_STATUS,
  TRANSFER_TYPE_LABELS,
  SIGNATURE_TYPES,
  SIGNATURE_TYPE_LABELS,
  HISTORY_ACTIONS,
} from '@/models/facility-transfer/transferConstants';
import { getValidSignature } from '@/models/facility-transfer/TransferSignature';
import {
  canEditTransfer,
  canCancelTransfer,
  canResolveDiscrepancy,
  canHandover,
  canReceive,
  isVicePrincipal,
  staffTransferPath,
} from '@/utils/facility-transfer/transferPermissions';
import { transferCrumbs } from '@/utils/facility-transfer/breadcrumbs';
import '@/styles/modules/facility-transfer.css';

const TABS = [
  { key: 'info', label: 'Thông tin chung' },
  { key: 'assets', label: 'Danh sách tài sản' },
  { key: 'people', label: 'Người thực hiện' },
  { key: 'history', label: 'Lịch sử xử lý' },
];

function InfoTab({ t, md }) {
  const place = (locId, campusId) => `${locationLabel(md.locationById(locId))} - ${md.campusById(campusId)?.shortName}`;
  return (
    <div className="grid-2">
      <dl className="info-list info-list--wide">
        <dt>Mã phiếu:</dt>
        <dd className="fw-600">{t.code}</dd>
        <dt>Phiên bản:</dt>
        <dd>v{t.version}</dd>
        <dt>Ngày lập:</dt>
        <dd>{formatDate(t.createdDate)}</dd>
        <dt>Ngày dự kiến bàn giao:</dt>
        <dd>{formatDate(t.expectedHandoverDate)}</dd>
        <dt>Loại luân chuyển:</dt>
        <dd>{TRANSFER_TYPE_LABELS[t.type]}</dd>
        <dt>Người tạo:</dt>
        <dd>{md.userById(t.createdBy)?.fullName}</dd>
      </dl>
      <dl className="info-list info-list--wide">
        <dt>Từ:</dt>
        <dd>{place(t.fromLocationId, t.fromCampusId)}</dd>
        <dt>Đến:</dt>
        <dd>{place(t.toLocationId, t.toCampusId)}</dd>
        <dt>Lý do:</dt>
        <dd>{t.reason}</dd>
        <dt>Ghi chú:</dt>
        <dd>{t.note || '—'}</dd>
        <dt>Tài liệu:</dt>
        <dd>{t.attachments.length ? <FileUploader files={t.attachments} onChange={() => {}} disabled /> : '—'}</dd>
      </dl>
    </div>
  );
}

function PeopleTab({ t, md }) {
  const people = [
    [SIGNATURE_TYPES.CREATOR, t.createdBy],
    [SIGNATURE_TYPES.HANDOVER, t.handoverUserId],
    [SIGNATURE_TYPES.RECEIVER, t.receiverUserId],
  ];
  return (
    <div className="grid-3">
      {people.map(([type, userId]) => {
        const user = md.userById(userId);
        const sig = getValidSignature(t, type);
        const invalid = t.signatures.filter((s) => s.type === type && !s.valid);
        return (
          <div key={type} className="card review-card">
            <div className="muted mb-8">{SIGNATURE_TYPE_LABELS[type]}</div>
            <div className="row mb-12">
              <Avatar user={user} size="lg" />
              <div>
                <div className="fw-600">{user?.fullName}</div>
                <div className="text-2 text-sm">
                  {ROLE_LABELS[user?.role]} · {md.campusById(user?.campusId)?.shortName}
                </div>
                <div className="text-2 text-sm">
                  {user?.phone} · {user?.email}
                </div>
              </div>
            </div>
            <div className="sig-box">
              {sig ? (
                <>
                  <img src={sig.signatureUrl} alt={`Chữ ký ${sig.signedByName}`} />
                  <div className="text-success text-sm row" style={{ gap: 4, justifyContent: 'center' }}>
                    <CheckCircle2 size={14} /> Đã ký {formatDateTime(sig.signedAt)} · v{sig.documentVersion}
                  </div>
                </>
              ) : (
                <span className="muted">Chưa xác nhận</span>
              )}
            </div>
            {invalid.length > 0 && (
              <div className="mt-8 text-xs">
                {invalid.map((s) => (
                  <div key={s.id} className="row text-2" style={{ gap: 6, alignItems: 'flex-start' }}>
                    <ShieldOff size={13} style={{ marginTop: 3 }} /> Chữ ký v{s.documentVersion} vô hiệu: {s.invalidReason}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HistoryTab({ t, md }) {
  const name = (id) => md.userById(id)?.fullName || '';
  return (
    <div className="history-layout">
      <div>
        <div className="subsection-title">Nhật ký xử lý</div>
        <ul className="history-list">
          {[...t.history].reverse().map((h) => (
            <li key={h.id}>
              <div className="history-list__dot" />
              <div>
                <div>
                  <b>{HISTORY_ACTIONS[h.action] || h.action}</b> · {name(h.userId)} <span className="muted">· v{h.version}</span>
                </div>
                {h.note && <div className="text-2">“{h.note}”</div>}
                <div className="muted text-xs">{formatDateTime(h.at)}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="stack">
        <div>
          <div className="subsection-title">Lịch sử phiên bản</div>
          {t.revisions.length === 0 ? (
            <div className="muted">Chưa gửi phiếu.</div>
          ) : (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>Phiên bản</th>
                    <th>Thời gian</th>
                    <th>Nội dung</th>
                    <th>Tài sản</th>
                  </tr>
                </thead>
                <tbody>
                  {[...t.revisions].reverse().map((r) => (
                    <tr key={r.id}>
                      <td className="fw-600">v{r.version}</td>
                      <td className="nowrap">{formatDateTime(r.createdAt)}</td>
                      <td>{r.changeNote}</td>
                      <td className="text-xs">{r.snapshot.items.map((i) => `${i.assetName}: ${i.quantity}`).join('; ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {t.revisionRequests.length > 0 && (
          <div>
            <div className="subsection-title">Yêu cầu điều chỉnh</div>
            {t.revisionRequests.map((r) => (
              <div key={r.id} className={`alert ${r.resolvedAt ? 'alert--success' : 'alert--warning'} mb-8`}>
                <AlertTriangle size={16} />
                <div className="text-sm">
                  <b>{name(r.requestedBy)}</b> · {formatDateTime(r.requestedAt)} · v{r.version}
                  <br />“{r.reason}”
                  {r.resolvedAt && (
                    <div>
                      Đã xử lý ở phiên bản v{r.resolvedVersion} ({formatDateTime(r.resolvedAt)})
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {t.discrepancies.length > 0 && (
          <div>
            <div className="subsection-title">Chênh lệch</div>
            {t.discrepancies.map((d) => (
              <div key={d.id} className={`alert ${d.status === 'OPEN' ? 'alert--purple' : 'alert--success'} mb-8`}>
                <Scale size={16} />
                <div className="text-sm">
                  <b>{name(d.reportedBy)}</b> · {formatDateTime(d.reportedAt)}
                  <br />“{d.description}”
                  {d.resolution && (
                    <div className="mt-8">
                      Xử lý bởi {name(d.resolution.resolvedBy)} ({formatDateTime(d.resolution.resolvedAt)}): {d.resolution.note}
                      <div>
                        {d.resolution.decisions
                          .map((x) => decisionText(x))
                          .filter(Boolean)
                          .join('; ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** PHT-06: detail and tracking of one transfer. */
export default function TransferDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const { transfer: t, loading, error, reload } = useTransfer(id);
  const [tab, setTab] = useState('info');
  const [preview, setPreview] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');

  if (loading || md.loading)
    return (
      <div className="page">
        <LoadingState />
      </div>
    );
  if (error || md.error)
    return (
      <div className="page">
        <ErrorState error={error || md.error} onRetry={reload} />
      </div>
    );

  const openRequest = t.revisionRequests.find((r) => !r.resolvedAt);
  const openDiscrepancy = t.discrepancies.find((d) => d.status === 'OPEN');

  const doCancel = async () => {
    if (!cancelReason.trim()) {
      setCancelError('Vui lòng nhập lý do hủy');
      return;
    }
    try {
      await cancelTransfer(t.id, cancelReason, user);
      toast.success(`Đã hủy phiếu ${t.code}`);
      setCancelOpen(false);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={transferCrumbs(`Chi tiết phiếu ${t.code}`)} />
      <div className="page__head">
        <div>
          <h1 className="page__title" style={{ marginBottom: 6 }}>
            Chi tiết phiếu luân chuyển - {t.code}
          </h1>
          <TransferStatusBadge status={t.status} size="lg" />
        </div>
        <div className="row row--wrap" style={{ gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
          {canCancelTransfer(t, user) && (
            <button
              className="btn btn--outline-danger"
              onClick={() => {
                setCancelReason('');
                setCancelError('');
                setCancelOpen(true);
              }}
            >
              <XCircle size={16} /> Hủy phiếu
            </button>
          )}
          {canEditTransfer(t, user) && (
            <Link className="btn btn--warning" to={`/facility/transfers/${t.id}/edit`}>
              <Pencil size={16} /> {t.status === TRANSFER_STATUS.DRAFT ? 'Tiếp tục soạn' : 'Điều chỉnh phiếu'}
            </Link>
          )}
          {canResolveDiscrepancy(t, user) && (
            <Link className="btn btn--warning" to={`/facility/transfers/${t.id}/discrepancy`}>
              <Scale size={16} /> Xử lý chênh lệch
            </Link>
          )}
          {canHandover(t, user) && (
            <Link className="btn btn--primary" to={staffTransferPath(t, user)}>
              <Handshake size={16} /> Bàn giao
            </Link>
          )}
          {canReceive(t, user) && (
            <Link className="btn btn--primary" to={staffTransferPath(t, user)}>
              <PackageCheck size={16} /> Xác nhận nhận
            </Link>
          )}
          <button className="btn" onClick={() => setPreview(true)}>
            <FileSearch size={16} /> Xem trước PDF
          </button>
          <Link className="btn" to={`/facility/transfers/${t.id}/print`}>
            <Printer size={16} /> In / Xuất
          </Link>
        </div>
      </div>

      <div className="card mt-16" style={{ padding: '20px 24px' }}>
        <TransferTimeline transfer={t} userById={md.userById} />
      </div>

      {openRequest && isVicePrincipal(user) && (
        <div className="alert alert--warning mt-16">
          <AlertTriangle size={20} />
          <div style={{ flex: 1 }}>
            <div className="fw-600">
              Yêu cầu điều chỉnh từ {md.userById(openRequest.requestedBy)?.fullName} · {formatDateTime(openRequest.requestedAt)}
            </div>
            <div className="mt-8">Lý do: “{openRequest.reason}”</div>
            <div className="mt-8 text-sm">
              Phiên bản đang bị yêu cầu: v{openRequest.version}. Lịch sử phiên bản xem ở tab “Lịch sử xử lý”.
            </div>
          </div>
          <Link className="btn btn--primary" to={`/facility/transfers/${t.id}/edit`}>
            <Pencil size={16} /> Mở wizard điều chỉnh
          </Link>
        </div>
      )}
      {openDiscrepancy && (
        <div className="alert alert--purple mt-16">
          <Scale size={20} />
          <div style={{ flex: 1 }}>
            <div className="fw-600">
              {md.userById(openDiscrepancy.reportedBy)?.fullName} báo chênh lệch · {formatDateTime(openDiscrepancy.reportedAt)}
            </div>
            <div className="mt-8">“{openDiscrepancy.description}”</div>
          </div>
          {isVicePrincipal(user) && (
            <Link className="btn btn--primary" to={`/facility/transfers/${t.id}/discrepancy`}>
              Xử lý ngay
            </Link>
          )}
        </div>
      )}

      <div className="card mt-16">
        <div className="tabs" style={{ padding: '0 16px' }} role="tablist">
          {TABS.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={tab === x.key}
              className={`tab ${tab === x.key ? 'tab--active' : ''}`}
              onClick={() => setTab(x.key)}
            >
              {x.key === 'history' && <History size={15} />}
              {x.label}
            </button>
          ))}
        </div>
        <div className="card__body">
          {tab === 'info' && <InfoTab t={t} md={md} />}
          {tab === 'assets' && (
            <TransferAssetTable items={t.items} columns={['document', 'handover', 'received', 'condition', 'note', 'image']} />
          )}
          {tab === 'people' && <PeopleTab t={t} md={md} />}
          {tab === 'history' && <HistoryTab t={t} md={md} />}
        </div>
      </div>

      {t.discrepancies.length > 0 && (
        <div className="mt-16">
          <DiscrepancyHistoryCard transfer={t} md={md} />
        </div>
      )}
      <div className="mt-16">
        <StockMovementCard transfer={t} md={md} />
      </div>
      <div className="mt-16">
        <TransferSignaturesCard transfer={t} md={md} highlightUserId={user.id} />
      </div>

      <div className="page-actions">
        <button className="btn" onClick={() => navigate('/facility/transfers')}>
          <ArrowLeft size={16} /> Về danh sách
        </button>
      </div>

      <Modal open={preview} title={`Xem trước phiếu ${t.code}`} onClose={() => setPreview(false)} size="xl">
        <PrintPreview model={buildPrintModel(t, md)} />
      </Modal>

      <ConfirmationModal
        open={cancelOpen}
        title={`Hủy phiếu ${t.code}?`}
        message="Phiếu bị hủy sẽ không thể tiếp tục xử lý. Người bàn giao và người nhận sẽ được thông báo."
        confirmLabel="Hủy phiếu"
        cancelLabel="Quay lại"
        danger
        onConfirm={doCancel}
        onClose={() => setCancelOpen(false)}
      >
        <div className="field mt-12">
          <label className="field__label" htmlFor="cancel-reason">
            Lý do hủy<span className="req">*</span>
          </label>
          <textarea
            id="cancel-reason"
            className={`textarea ${cancelError ? 'textarea--error' : ''}`}
            rows={3}
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value);
              setCancelError('');
            }}
          />
          {cancelError && <span className="field__error">{cancelError}</span>}
        </div>
      </ConfirmationModal>
    </div>
  );
}
