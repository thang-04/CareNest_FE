import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Scale, Info, List, UserRound, Lock, Hourglass } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTransfer } from '@/hooks/facility-transfer/useTransfers';
import { useMasterData } from '@/hooks/useMasterData';
import { confirmReceipt, reportDiscrepancy } from '@/services/facility-transfer/transferService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { TransferStatusBadge } from '@/components/facility-transfer/TransferStatusBadge';
import { TransferInfoCard } from '@/components/facility-transfer/TransferInfoCard';
import { TransferSignaturesCard } from '@/components/facility-transfer/TransferSignaturesCard';
import { StockMovementCard } from '@/components/facility-transfer/StockMovementCard';
import { TransferPrintButtons } from '@/components/facility-transfer/TransferPrintButtons';
import { DiscrepancyHistoryCard } from '@/components/facility-transfer/DiscrepancyHistoryCard';
import { SignaturePicker } from '@/components/signature/SignaturePicker';
import { DiscrepancyModal } from '@/components/facility-transfer/DiscrepancyModal';
import { ConditionSelect, ConditionBadge } from '@/components/asset/AssetVisuals';
import { ImageUploader } from '@/components/upload/ImageUploader';
import { canReceive, getMyTransferRole, canViewTransfer } from '@/utils/facility-transfer/transferPermissions';
import { getValidSignature } from '@/models/facility-transfer/TransferSignature';
import { expectedReceiveQuantity } from '@/models/facility-transfer/FacilityTransferItem';
import { SIGNATURE_TYPES, TRANSFER_STATUS } from '@/models/facility-transfer/transferConstants';
import { decisionText } from '@/components/facility-transfer/DiscrepancyHistoryCard';
import { formatDateTime } from '@/utils/format';
import { transferCrumbs } from '@/utils/facility-transfer/breadcrumbs';
import '@/styles/modules/facility-transfer.css';

const initRows = (t) =>
  Object.fromEntries(
    t.items.map((i) => [
      i.id,
      {
        receivedQuantity: i.receivedQuantity ?? expectedReceiveQuantity(i),
        damagedQuantity: 0,
        receivedCondition: i.receivedCondition || i.handoverCondition || i.condition,
        receivedNote: i.receivedNote || '',
        receivedImages: i.receivedImages || [],
      },
    ]),
  );

/** STAFF-03: receiver checks the real assets and confirms, or reports a discrepancy. */
export default function ReceivePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const { transfer: t, loading, error, reload } = useTransfer(id, { live: false });

  const [rows, setRows] = useState({});
  const [signature, setSignature] = useState(null);
  const [sigError, setSigError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discrepancyOpen, setDiscrepancyOpen] = useState(false);

  useEffect(() => {
    if (t) setRows(initRows(t));
  }, [t]);

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
  if (!canViewTransfer(t, user))
    return (
      <div className="page">
        <EmptyState icon={Lock} title="Bạn không có quyền xem phiếu này" />
      </div>
    );

  const actionable = canReceive(t, user);
  const handoverSig = getValidSignature(t, SIGNATURE_TYPES.HANDOVER);
  const receiverSig = getValidSignature(t, SIGNATURE_TYPES.RECEIVER);
  const lastResolved = [...t.discrepancies].reverse().find((d) => d.status === 'RESOLVED');
  const items = t.items.filter((i) => i.quantity > 0 || i.handoverQuantity);
  const setRow = (itemId, patch) => setRows((r) => ({ ...r, [itemId]: { ...r[itemId], ...patch } }));

  const mismatches = items.filter((i) => {
    const r = rows[i.id] || {};
    return (
      Number(r.receivedQuantity) !== expectedReceiveQuantity(i) ||
      Number(r.damagedQuantity) > 0 ||
      ['NEED_REPAIR', 'BROKEN'].includes(r.receivedCondition)
    );
  });

  const askConfirm = () => {
    if (mismatches.length) {
      toast.warning('Có tài sản khác số lượng cần nhận hoặc bị hư hỏng. Hãy dùng “Báo chênh lệch”.');
      return;
    }
    if (!signature) {
      setSigError('Vui lòng chọn hoặc tải lên chữ ký');
      return;
    }
    setConfirmOpen(true);
  };

  const payloadItems = () => items.map((i) => ({ itemId: i.id, ...rows[i.id] }));

  const doConfirm = async () => {
    try {
      await confirmReceipt(t.id, { items: payloadItems(), signatureUrl: signature }, user);
      toast.success(`Phiếu ${t.code} đã hoàn thành. Vị trí và số lượng tài sản đã được cập nhật.`, 'Xác nhận nhận thành công');
      setConfirmOpen(false);
      reload({ silent: true });
    } catch (err) {
      setConfirmOpen(false);
      toast.error(err.message, 'Không thể xác nhận nhận');
    }
  };

  const doReport = async (description) => {
    if (!signature) {
      setSigError('Vui lòng ký để gửi báo chênh lệch');
      toast.error('Vui lòng chọn chữ ký ở khung “Chữ ký của tôi” trước khi gửi báo chênh lệch');
      return;
    }
    try {
      await reportDiscrepancy(t.id, { description, items: payloadItems(), signatureUrl: signature }, user);
      toast.success('Đã gửi báo chênh lệch tới Phó hiệu trưởng', 'Báo chênh lệch');
      setDiscrepancyOpen(false);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const statusNote = {
    [TRANSFER_STATUS.PENDING_HANDOVER]: 'Người bàn giao chưa ký. Bạn chỉ thao tác được sau khi người bàn giao xác nhận bàn giao.',
    [TRANSFER_STATUS.REVISION_REQUESTED]: 'Phiếu đang được Phó hiệu trưởng điều chỉnh. Bạn chưa cần thao tác.',
    [TRANSFER_STATUS.PENDING_RESOLUTION]:
      'Bạn đã báo chênh lệch và ký. Phó hiệu trưởng đang xử lý: nếu chấp nhận, phiếu hoàn thành ngay; nếu yêu cầu giao thêm / trả lại, bạn sẽ kiểm tra và xác nhận lại.',
    [TRANSFER_STATUS.COMPLETED]: `Bạn đã xác nhận nhận lúc ${formatDateTime(receiverSig?.signedAt)}. Phiếu đã hoàn thành.`,
    [TRANSFER_STATUS.CANCELLED]: 'Phiếu đã bị hủy.',
  }[t.status];

  return (
    <div className="page">
      <Breadcrumb items={transferCrumbs(`Xác nhận nhận tài sản - ${t.code}`)} />
      <div className="page__head">
        <div>
          <h1 className="page__title" style={{ marginBottom: 8 }}>
            Xác nhận nhận tài sản - {t.code}
          </h1>
          <TransferStatusBadge status={t.status} size="lg" />
        </div>
        <div style={{ marginTop: 8 }}>
          <TransferPrintButtons transfer={t} md={md} />
        </div>
      </div>

      {actionable ? (
        <div className="alert alert--info mt-16">
          <Info size={18} />
          <div>
            Người bàn giao <b>{md.userById(handoverSig.signedBy)?.fullName}</b> đã ký lúc {formatDateTime(handoverSig.signedAt)}. Kiểm tra
            thực tế: nhập <b>số thực nhận</b> và <b>trong đó hỏng</b> (cái hỏng không nhận, trả lại bên giao). Tất cả đúng thì chọn “
            <b>Xác nhận nhận</b>”; có thiếu / thừa / hỏng thì ký rồi chọn “<b>Báo chênh lệch</b>”.
          </div>
        </div>
      ) : (
        <div className="alert alert--warning mt-16">
          <Hourglass size={18} />
          <div>{statusNote}</div>
        </div>
      )}

      {actionable && lastResolved && (
        <div className="alert alert--purple mt-12">
          <Scale size={18} />
          <div>
            <b>PHT đã xử lý chênh lệch</b> ({formatDateTime(lastResolved.resolution.resolvedAt)}): {lastResolved.resolution.note}
            <div className="text-sm">
              {lastResolved.resolution.decisions
                .map((d) => `${t.items.find((i) => i.id === d.itemId)?.assetName}: ${decisionText(d)}`)
                .join(' · ')}
            </div>
            Vui lòng kiểm tra và xác nhận lại.
          </div>
        </div>
      )}

      <div className="mt-16">
        <TransferInfoCard transfer={t} md={md} myRole={getMyTransferRole(t, user)} />
      </div>

      <div className="card card--soft-header mt-16">
        <div className="card__header">
          <div className="card__title">
            <List size={20} /> Danh sách tài sản cần nhận
          </div>
        </div>
        <div className="card__body">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="center">STT</th>
                  <th>Mã tài sản</th>
                  <th>Tên tài sản</th>
                  <th className="center">SL theo phiếu</th>
                  <th className="center">SL đã bàn giao</th>
                  <th className="center">SL cần nhận</th>
                  <th className="center">SL thực nhận</th>
                  <th className="center">Trong đó hỏng</th>
                  <th className="center">Tình trạng thực nhận</th>
                  <th>Ghi chú</th>
                  <th className="center">Ảnh</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => {
                  const r = rows[i.id] || {};
                  const expected = expectedReceiveQuantity(i);
                  const diff = Number(r.receivedQuantity) - expected;
                  return (
                    <tr key={i.id}>
                      <td className="center">{idx + 1}</td>
                      <td>{i.assetCode}</td>
                      <td>
                        {i.assetName}
                        {i.handoverNote && <div className="muted text-xs">Bàn giao: {i.handoverNote}</div>}
                        {(i.supplementHistory || []).map((x, k) => (
                          <div key={k} className="text-primary text-xs">
                            Đã giao thêm {x.quantity}
                            {x.returned ? `, lấy về ${x.returned}` : ''}
                            {x.note ? ` – ${x.note}` : ''}
                          </div>
                        ))}
                      </td>
                      <td className="center">{i.quantity}</td>
                      <td className="center">{i.handoverQuantity ?? '—'}</td>
                      <td className="center fw-600">{expected}</td>
                      <td className="center" style={{ width: 130 }}>
                        {actionable ? (
                          <>
                            <input
                              type="number"
                              min={0}
                              className={`input qty-input ${diff !== 0 ? 'input--error' : ''}`}
                              value={r.receivedQuantity ?? ''}
                              onChange={(e) => setRow(i.id, { receivedQuantity: e.target.value === '' ? '' : Number(e.target.value) })}
                              aria-label={`Số lượng thực nhận ${i.assetName}`}
                            />
                            {diff !== 0 && r.receivedQuantity !== '' && (
                              <div className="text-danger text-xs">Chênh lệch {diff > 0 ? `+${diff}` : diff}</div>
                            )}
                          </>
                        ) : (
                          (i.receivedQuantity ?? '—')
                        )}
                      </td>
                      <td className="center" style={{ width: 110 }}>
                        {actionable ? (
                          <input
                            type="number"
                            min={0}
                            max={r.receivedQuantity || 0}
                            className={`input qty-input ${Number(r.damagedQuantity) > 0 ? 'input--error' : ''}`}
                            value={r.damagedQuantity ?? 0}
                            onChange={(e) => setRow(i.id, { damagedQuantity: e.target.value === '' ? '' : Number(e.target.value) })}
                            aria-label={`Số lượng hỏng trong số thực nhận ${i.assetName}`}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="center" style={{ width: 160 }}>
                        {actionable ? (
                          <ConditionSelect value={r.receivedCondition} onChange={(v) => setRow(i.id, { receivedCondition: v })} />
                        ) : (
                          <ConditionBadge value={i.receivedCondition} />
                        )}
                      </td>
                      <td style={{ minWidth: 160 }}>
                        {actionable ? (
                          <input
                            className="input"
                            placeholder="Ghi chú..."
                            value={r.receivedNote || ''}
                            onChange={(e) => setRow(i.id, { receivedNote: e.target.value })}
                            aria-label={`Ghi chú ${i.assetName}`}
                          />
                        ) : (
                          i.receivedNote || '—'
                        )}
                      </td>
                      <td className="center">
                        <ImageUploader
                          images={actionable ? r.receivedImages : i.receivedImages}
                          onChange={(imgs) => setRow(i.id, { receivedImages: imgs })}
                          disabled={!actionable}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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

      <div className="split-2 mt-16">
        <div className="card card--soft-header">
          <div className="card__header">
            <div className="card__title">
              <UserRound size={20} /> Chữ ký của tôi
            </div>
          </div>
          <div className="card__body">
            {actionable ? (
              <SignaturePicker variant="compact" value={signature} onChange={onSignature} error={sigError} />
            ) : receiverSig ? (
              <div className="sig-box">
                <img src={receiverSig.signatureUrl} alt="Chữ ký người nhận" />
                <div className="fw-600">{receiverSig.signedByName}</div>
              </div>
            ) : (
              <div className="muted">Chưa xác nhận</div>
            )}
          </div>
        </div>
        <div className="card card--soft-header">
          <div className="card__header">
            <div className="card__title">
              <Info size={20} /> Kết quả kiểm tra
            </div>
          </div>
          <div className="card__body">
            {actionable ? (
              mismatches.length ? (
                <div className="alert alert--danger">
                  <Scale size={18} />
                  <div>{mismatches.length} tài sản bị thiếu, thừa hoặc hỏng. Chọn chữ ký rồi bấm “Báo chênh lệch”.</div>
                </div>
              ) : (
                <div className="alert alert--success">
                  <Check size={18} />
                  <div>Tất cả tài sản khớp với số lượng bàn giao. Bạn có thể xác nhận nhận.</div>
                </div>
              )
            ) : (
              <div className="muted">{statusNote}</div>
            )}
          </div>
        </div>
      </div>

      <div className="page-actions">
        <button className="btn btn--lg" onClick={() => navigate('/facility/transfers')}>
          <ArrowLeft size={17} /> Quay lại
        </button>
        {actionable && (
          <div className="row" style={{ gap: 12 }}>
            <button className="btn btn--lg btn--outline-danger" onClick={() => setDiscrepancyOpen(true)}>
              <Scale size={18} /> Báo chênh lệch
            </button>
            <button className="btn btn--lg btn--primary" onClick={askConfirm} disabled={mismatches.length > 0}>
              <Check size={18} /> Xác nhận nhận
            </button>
          </div>
        )}
      </div>

      <DiscrepancyModal open={discrepancyOpen} items={items} rows={rows} onSubmit={doReport} onClose={() => setDiscrepancyOpen(false)} />
      <ConfirmationModal
        open={confirmOpen}
        title="Xác nhận đã nhận đủ tài sản?"
        message="Sau khi xác nhận, phiếu chuyển sang Hoàn thành và tồn kho được cập nhật. Thao tác này không thể hoàn tác."
        confirmLabel="Ký và xác nhận nhận"
        onConfirm={doConfirm}
        onClose={() => setConfirmOpen(false)}
      >
        <ul className="mt-8" style={{ paddingLeft: 18, margin: '8px 0 0' }}>
          {items
            .filter((i) => expectedReceiveQuantity(i) > 0)
            .map((i) => (
              <li key={i.id}>
                {i.assetName}: <span className="text-danger">−{expectedReceiveQuantity(i)}</span> tại{' '}
                {md.locationById(t.fromLocationId)?.name}, <span className="text-success">+{expectedReceiveQuantity(i)}</span> tại{' '}
                {md.locationById(t.toLocationId)?.name}
              </li>
            ))}
        </ul>
        {signature && (
          <div className="sig-box mt-12">
            <img src={signature} alt="Chữ ký sẽ dùng" />
          </div>
        )}
      </ConfirmationModal>
    </div>
  );
}
