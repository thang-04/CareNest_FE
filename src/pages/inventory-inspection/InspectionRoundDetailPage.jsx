import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, XCircle, Stamp, Eye, ClipboardCheck, History, Lock, PenLine, CheckCircle2, Boxes } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { SignaturePicker } from '@/components/signature/SignaturePicker';
import { ConditionBadge } from '@/components/asset/AssetVisuals';
import { useInspection } from '@/hooks/inventory-inspection/useInspections';
import { cancelInspection, completeInspection } from '@/services/inventory-inspection/inspectionService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { LoadingState, ErrorState, EmptyState, Spinner } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Modal } from '@/components/ui/Modal';
import { RoundStatusBadge, SheetStatusBadge, ProgressBar } from '@/components/inventory-inspection/InspectionBadges';
import { ROUND_STATUS, SHEET_STATUS, ROUND_TYPE_LABELS, INSPECTION_HISTORY } from '@/models/inventory-inspection/inspectionConstants';
import { sheetSummary } from '@/models/inventory-inspection/InspectionRound';
import {
  canApproveRound,
  canCancelRound,
  canReviewSheet,
  isVicePrincipal,
  canViewRound,
} from '@/utils/inventory-inspection/inspectionPermissions';
import { inspectionCrumbs } from '@/utils/inventory-inspection/breadcrumbs';
import { describeScope } from '@/utils/inventory-inspection/inspectionScope';
import { formatDate, formatDateTime } from '@/utils/format';
import { locationLabel } from '@/models/Location';
import '@/styles/modules/inventory-inspection.css';

function Steps({ round }) {
  const active = round.sheets.filter((s) => s.status !== SHEET_STATUS.CANCELLED);
  const submitted = active.filter((s) => [SHEET_STATUS.SUBMITTED, SHEET_STATUS.APPROVED].includes(s.status)).length;
  const approved = active.filter((s) => s.status === SHEET_STATUS.APPROVED).length;
  const done = round.status === ROUND_STATUS.COMPLETED;
  const steps = [
    { label: 'Lập & ký', sub: formatDate(round.signatures[0]?.signedAt), done: true },
    { label: 'Kiểm đếm', sub: `${submitted}/${active.length} phiếu đã nộp`, done: submitted === active.length && active.length > 0 },
    { label: 'Duyệt phiếu', sub: `${approved}/${active.length} phiếu đã duyệt`, done: approved === active.length && active.length > 0 },
    {
      label: 'Phê duyệt kết quả',
      sub: done ? formatDate(round.signatures.find((s) => s.type === 'APPROVER')?.signedAt) : 'Chờ PHT ký',
      done,
    },
  ];
  return <ProgressSteps steps={steps} cancelled={round.status === ROUND_STATUS.CANCELLED} />;
}

function RoundSignatures({ round, md }) {
  const creator = round.signatures.find((s) => s.type === 'CREATOR');
  const approver = round.signatures.find((s) => s.type === 'APPROVER');
  const box = (title, sig, fallbackName, extra) => (
    <div className={`sig-slot ${sig ? 'sig-slot--signed' : ''}`} key={title + (fallbackName || '')}>
      <div className="sig-slot__title">{title}</div>
      {extra && <div className="sig-slot__role">{extra}</div>}
      <div className="sig-slot__img">
        {sig ? (
          <img src={sig.signatureUrl} alt={`Chữ ký ${sig.signedByName}`} />
        ) : (
          <span className="muted" style={{ fontStyle: 'italic' }}>
            Chưa ký
          </span>
        )}
      </div>
      <div className="fw-600">{sig?.signedByName || fallbackName}</div>
      {sig && (
        <div className="sig-slot__status text-success">
          <CheckCircle2 size={13} /> {formatDateTime(sig.signedAt)}
        </div>
      )}
    </div>
  );
  return (
    <div className="card card--soft-header">
      <div className="card__header">
        <div className="card__title">
          <PenLine size={20} /> Chữ ký xác nhận
        </div>
      </div>
      <div className="card__body kk-sign-grid">
        {box('Người lập', creator, md.userById(round.createdBy)?.fullName, '(Phó hiệu trưởng)')}
        {round.sheets
          .filter((s) => s.status !== SHEET_STATUS.CANCELLED)
          .map((s) =>
            box(
              'Người kiểm kê',
              s.inspectorSignature,
              md.userById(s.inspectorUserId)?.fullName,
              locationLabel(md.locationById(s.locationId)),
            ),
          )}
        {box('Phê duyệt kết quả', approver, md.userById(round.createdBy)?.fullName, '(Phó hiệu trưởng)')}
      </div>
    </div>
  );
}

/** Variance across all sheets (after completion: what was applied). */
function VarianceCard({ round, md }) {
  const rows =
    round.status === ROUND_STATUS.COMPLETED
      ? round.adjustments
      : round.sheets.flatMap((s) =>
          s.items
            .filter(
              (i) =>
                i.actualQuantity != null &&
                (i.actualQuantity !== i.bookQuantity || (i.actualCondition && i.actualCondition !== i.bookCondition)),
            )
            .map((i) => ({ ...i, locationId: s.locationId, difference: i.actualQuantity - i.bookQuantity, sheetStatus: s.status })),
        );
  return (
    <div className="card card--soft-header">
      <div className="card__header">
        <div className="card__title">
          <Boxes size={20} /> {round.status === ROUND_STATUS.COMPLETED ? 'Điều chỉnh sau kiểm kê' : 'Chênh lệch đã ghi nhận'}
        </div>
        {round.status === ROUND_STATUS.COMPLETED && (
          <span className={`chip ${round.applyAdjustments ? 'chip--green' : 'chip--gray'}`}>
            {round.applyAdjustments ? 'Đã cập nhật tồn kho & tình trạng' : 'Không cập nhật tồn kho'}
          </span>
        )}
      </div>
      <div className="card__body">
        {rows.length === 0 ? (
          <div className="muted">Không có chênh lệch giữa sổ sách và thực tế.</div>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Lớp/phòng</th>
                  <th>Tài sản</th>
                  <th className="center">Sổ sách</th>
                  <th className="center">Thực tế</th>
                  <th className="center">Chênh lệch</th>
                  <th className="center">Tình trạng</th>
                  <th>Ghi chú</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.locationId}-${r.assetId}`}>
                    <td>{locationLabel(md.locationById(r.locationId))}</td>
                    <td>
                      <div className="fw-600">{r.assetName}</div>
                      <div className="muted text-xs">{r.assetCode}</div>
                    </td>
                    <td className="center">{r.bookQuantity}</td>
                    <td className="center fw-600">{r.actualQuantity}</td>
                    <td className="center">
                      {r.difference === 0 ? (
                        '0'
                      ) : (
                        <span className={`kk-diff ${r.difference < 0 ? 'kk-diff--minus' : 'kk-diff--plus'}`}>
                          {r.difference > 0 ? `+${r.difference}` : r.difference}
                        </span>
                      )}
                    </td>
                    <td className="center">
                      <ConditionBadge value={r.actualCondition} />
                    </td>
                    <td className="text-2">{r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InspectionRoundDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const { round: r, loading, error, reload } = useInspection(id);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [apply, setApply] = useState(true);
  const [signature, setSignature] = useState(null);
  const [sigError, setSigError] = useState('');
  const [busy, setBusy] = useState(false);
  const onSignature = useCallback(({ url }) => {
    setSignature(url);
    setSigError('');
  }, []);

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
  if (!canViewRound(r, user))
    return (
      <div className="page">
        <EmptyState icon={Lock} title="Bạn không có quyền xem đợt kiểm kê này" />
      </div>
    );

  const vp = isVicePrincipal(user);
  const sheets = vp ? r.sheets : r.sheets.filter((s) => s.inspectorUserId === user.id);
  const adjustCount = r.sheets
    .flatMap((s) => s.items)
    .filter((i) => i.actualQuantity != null && (i.actualQuantity !== i.bookQuantity || i.actualCondition !== i.bookCondition)).length;

  const doCancel = async () => {
    if (!cancelReason.trim()) {
      setCancelError('Vui lòng nhập lý do hủy');
      return;
    }
    try {
      await cancelInspection(r.id, cancelReason, user);
      toast.success(`Đã hủy đợt ${r.code}, đã mở khóa luân chuyển`);
      setCancelOpen(false);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const doComplete = async () => {
    if (!signature) {
      setSigError('Vui lòng chọn chữ ký phê duyệt');
      return;
    }
    setBusy(true);
    try {
      await completeInspection(r.id, { signatureUrl: signature, note: approveNote, applyAdjustments: apply }, user);
      toast.success(
        apply ? 'Đã phê duyệt kết quả và cập nhật tồn kho theo số thực tế' : 'Đã phê duyệt kết quả kiểm kê',
        'Hoàn thành kiểm kê',
      );
      setApproveOpen(false);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={inspectionCrumbs(`Đợt ${r.code}`)} />
      <div className="page__head">
        <div>
          <h1 className="page__title" style={{ marginBottom: 6 }}>
            {r.code} – {r.name}
          </h1>
          <RoundStatusBadge status={r.status} size="lg" />
        </div>
        <div className="row row--wrap" style={{ gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
          {canCancelRound(r, user) && (
            <button
              className="btn btn--outline-danger"
              onClick={() => {
                setCancelReason('');
                setCancelError('');
                setCancelOpen(true);
              }}
            >
              <XCircle size={16} /> Hủy đợt
            </button>
          )}
          <Link className="btn" to={`/facility/inspections/${r.id}/print`}>
            <Printer size={16} /> In / Xuất biên bản
          </Link>
          {canApproveRound(r, user) && (
            <button className="btn btn--primary" onClick={() => setApproveOpen(true)}>
              <Stamp size={16} /> Phê duyệt kết quả
            </button>
          )}
        </div>
      </div>

      <div className="card mt-16" style={{ padding: '20px 24px' }}>
        <Steps round={r} />
      </div>

      {r.status === ROUND_STATUS.PENDING_APPROVAL && vp && (
        <div className="alert alert--purple mt-16">
          <Stamp size={18} />
          <div>
            Tất cả phiếu đã được duyệt. Bấm <b>Phê duyệt kết quả</b> để ký, cập nhật tồn kho theo số thực tế và kết thúc đợt kiểm kê.
          </div>
        </div>
      )}
      {[ROUND_STATUS.IN_PROGRESS, ROUND_STATUS.PENDING_APPROVAL].includes(r.status) && (
        <div className="alert alert--warning mt-12">
          <Lock size={18} />
          <div>Đang khóa luân chuyển tài sản của {r.sheets.length} lớp/phòng thuộc đợt này đến khi kiểm kê hoàn thành hoặc bị hủy.</div>
        </div>
      )}

      <div className="card mt-16">
        <div className="card__body info-columns">
          <dl className="info-list">
            <dt>Loại:</dt>
            <dd>{ROUND_TYPE_LABELS[r.type]}</dd>
            <dt>Địa điểm:</dt>
            <dd>{describeScope(r, md).where}</dd>
            <dt>Tài sản:</dt>
            <dd>{describeScope(r, md).what}</dd>
          </dl>
          <dl className="info-list">
            <dt>Thời gian:</dt>
            <dd>
              {formatDate(r.startDate)} – {formatDate(r.deadline)}
            </dd>
            <dt>Người lập:</dt>
            <dd>{md.userById(r.createdBy)?.fullName}</dd>
          </dl>
          <dl className="info-list">
            <dt>Yêu cầu:</dt>
            <dd>{r.note || '—'}</dd>
            {r.approvalNote && (
              <>
                <dt>Kết luận:</dt>
                <dd>{r.approvalNote}</dd>
              </>
            )}
          </dl>
        </div>
      </div>

      <div className="card card--soft-header mt-16">
        <div className="card__header">
          <div className="card__title">
            <ClipboardCheck size={20} /> Phiếu kiểm kê ({sheets.length})
          </div>
        </div>
        <div className="card__body">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Lớp/phòng</th>
                  <th>Người kiểm kê</th>
                  <th style={{ minWidth: 150 }}>Đã kiểm</th>
                  <th className="center">Lệch</th>
                  <th className="center">Hư hỏng</th>
                  <th>Nộp lúc</th>
                  <th>Trạng thái</th>
                  <th className="center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sheets.map((s) => {
                  const sum = sheetSummary(s);
                  const link = `/facility/inspections/${r.id}/sheets/${s.id}`;
                  return (
                    <tr key={s.id} className="row-click" onClick={() => navigate(link)}>
                      <td className="fw-600 text-primary">{s.code}</td>
                      <td>{locationLabel(md.locationById(s.locationId))}</td>
                      <td>{md.userById(s.inspectorUserId)?.fullName}</td>
                      <td>
                        <ProgressBar value={sum.counted} total={sum.total} tone={sum.counted === sum.total ? 'green' : 'primary'} />
                      </td>
                      <td className="center">{sum.variance ? <span className="chip chip--orange">{sum.variance}</span> : '0'}</td>
                      <td className="center">{sum.damaged ? <span className="chip chip--red">{sum.damaged}</span> : '0'}</td>
                      <td>
                        {s.submittedAt ? (
                          <>
                            <div>{formatDate(s.submittedAt)}</div>
                            <div className="muted text-xs">{formatDateTime(s.submittedAt).slice(-5)}</div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <SheetStatusBadge status={s.status} />
                      </td>
                      <td className="center" onClick={(e) => e.stopPropagation()}>
                        {canReviewSheet(r, s, user) ? (
                          <button className="btn btn--sm btn--primary" onClick={() => navigate(link)}>
                            <ClipboardCheck size={15} /> Duyệt
                          </button>
                        ) : (
                          <button className="btn btn--sm" onClick={() => navigate(link)}>
                            <Eye size={15} /> Xem
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {vp && (
        <div className="mt-16">
          <VarianceCard round={r} md={md} />
        </div>
      )}
      <div className="mt-16">
        <RoundSignatures round={r} md={md} />
      </div>

      {vp && (
        <div className="card mt-16">
          <div className="card__body">
            <div className="subsection-title row" style={{ gap: 6 }}>
              <History size={16} /> Lịch sử
            </div>
            <ul className="history-list">
              {[...r.history].reverse().map((h) => (
                <li key={h.id}>
                  <div className="history-list__dot" />
                  <div>
                    <b>{INSPECTION_HISTORY[h.action] || h.action}</b> · {md.userById(h.userId)?.fullName}
                    {h.note && <div className="text-2">{h.note}</div>}
                    <div className="muted text-xs">{formatDateTime(h.at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="page-actions">
        <button className="btn" onClick={() => navigate('/facility/inspections')}>
          <ArrowLeft size={16} /> Về danh sách
        </button>
      </div>

      <ConfirmationModal
        open={cancelOpen}
        title={`Hủy đợt ${r.code}?`}
        message="Các phiếu chưa duyệt sẽ bị hủy, tồn kho không thay đổi và luân chuyển được mở khóa."
        confirmLabel="Hủy đợt kiểm kê"
        danger
        onConfirm={doCancel}
        onClose={() => setCancelOpen(false)}
      >
        <div className="field mt-12">
          <label className="field__label" htmlFor="kk-cancel">
            Lý do hủy<span className="req">*</span>
          </label>
          <textarea
            id="kk-cancel"
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

      <Modal
        open={approveOpen}
        size="lg"
        title={`Phê duyệt kết quả ${r.code}`}
        onClose={busy ? undefined : () => setApproveOpen(false)}
        footer={
          <>
            <button className="btn" onClick={() => setApproveOpen(false)} disabled={busy}>
              Quay lại
            </button>
            <button className="btn btn--primary" onClick={doComplete} disabled={busy}>
              {busy ? <Spinner small /> : <Stamp size={16} />} Ký và phê duyệt
            </button>
          </>
        }
      >
        <div className="alert alert--info mb-12">
          <CheckCircle2 size={18} />
          <div>
            {r.sheets.filter((s) => s.status === SHEET_STATUS.APPROVED).length} phiếu đã duyệt · <b>{adjustCount}</b> dòng tài sản có chênh
            lệch số lượng hoặc tình trạng.
          </div>
        </div>
        <label className="checkbox mb-12">
          <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} />
          Cập nhật số lượng và tình trạng tài sản theo kết quả kiểm kê thực tế
        </label>
        <div className="field mb-12">
          <label className="field__label" htmlFor="kk-approve-note">
            Kết luận / ghi chú
          </label>
          <textarea
            id="kk-approve-note"
            className="textarea"
            rows={3}
            value={approveNote}
            onChange={(e) => setApproveNote(e.target.value)}
            placeholder="Ví dụ: Ghi nhận thiếu 1 máy in, lập phiếu luân chuyển bổ sung."
          />
        </div>
        <div className="subsection-title">Chữ ký phê duyệt</div>
        <SignaturePicker variant="compact" value={signature} onChange={onSignature} error={sigError} />
      </Modal>
    </div>
  );
}
