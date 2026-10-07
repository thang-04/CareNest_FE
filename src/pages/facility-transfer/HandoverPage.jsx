import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle, Info, List, UserRound, FileText, Lock, Scale, PackagePlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useTransfer } from '@/hooks/facility-transfer/useTransfers';
import { useMasterData } from '@/hooks/useMasterData';
import { confirmHandover, requestTransferRevision, confirmSupplement } from '@/services/facility-transfer/transferService';
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
import { AdjustmentRequestModal } from '@/components/facility-transfer/AdjustmentRequestModal';
import { ConditionSelect, ConditionBadge } from '@/components/asset/AssetVisuals';
import { ImageUploader } from '@/components/upload/ImageUploader';
import {
  canHandover,
  getMyTransferRole,
  canViewTransfer,
  isSupplementMode,
  getOpenDiscrepancy,
} from '@/utils/facility-transfer/transferPermissions';
import { getValidSignature } from '@/models/facility-transfer/TransferSignature';
import { SIGNATURE_TYPES, TRANSFER_STATUS } from '@/models/facility-transfer/transferConstants';
import { formatDateTime } from '@/utils/format';
import { transferCrumbs } from '@/utils/facility-transfer/breadcrumbs';
import '@/styles/modules/facility-transfer.css';

const initRows = (t) =>
  Object.fromEntries(
    t.items.map((i) => [
      i.id,
      {
        handoverQuantity: i.handoverQuantity ?? i.quantity,
        handoverCondition: i.handoverCondition || i.condition,
        handoverNote: i.handoverNote || '',
        handoverImages: i.handoverImages || [],
        supplementQuantity: i.supplementRequired ?? 0,
        returnedQuantity: i.returnRequired ?? 0,
        supplementNote: '',
        supplementImages: [],
      },
    ]),
  );

/**
 * STAFF-02: the handover person
 *  - checks the document, then signs or asks for a revision;
 *  - after the VP resolves a discrepancy: delivers the missing / replacement units and takes back surplus units.
 */
export default function HandoverPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const md = useMasterData();
  const { transfer: t, loading, error, reload } = useTransfer(id, { live: false });

  const [rows, setRows] = useState({});
  const [rowErrors, setRowErrors] = useState({});
  const [signature, setSignature] = useState(null);
  const [sigError, setSigError] = useState('');
  const [note, setNote] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const supplementMode = canHandover(t, user) && isSupplementMode(t);
  const actionable = canHandover(t, user) && !supplementMode;
  const handoverSig = getValidSignature(t, SIGNATURE_TYPES.HANDOVER);
  const openDiscrepancy = getOpenDiscrepancy(t);
  const lastResolved = [...t.discrepancies].reverse().find((d) => d.status === 'RESOLVED');
  const supplementItems = t.items.filter((i) => i.supplementRequired > 0 || i.returnRequired > 0);

  const setRow = (itemId, patch) => {
    setRows((r) => ({ ...r, [itemId]: { ...r[itemId], ...patch } }));
    setRowErrors((e) => ({ ...e, [itemId]: undefined }));
  };

  /* ----- normal handover ----- */
  const validateHandover = () => {
    const errs = {};
    t.items.forEach((i) => {
      const r = rows[i.id];
      const q = Number(r.handoverQuantity);
      if (r.handoverQuantity === '' || !Number.isInteger(q) || q < 0) errs[i.id] = 'Số lượng không hợp lệ';
      else if (q > i.quantity) errs[i.id] = `Không vượt quá ${i.quantity}`;
      else if (q !== i.quantity && !r.handoverNote.trim()) errs[i.id] = 'Nhập ghi chú vì khác số lượng theo phiếu';
    });
    setRowErrors(errs);
    if (!signature) setSigError('Vui lòng chọn hoặc tải lên chữ ký');
    return Object.keys(errs).length === 0 && !!signature;
  };

  /* ----- supplement only ----- */
  const validateSupplement = () => {
    const errs = {};
    supplementItems.forEach((i) => {
      const r = rows[i.id];
      const need = i.supplementRequired || 0;
      const back = i.returnRequired || 0;
      const q = Number(r.supplementQuantity);
      const b = Number(r.returnedQuantity);
      if (r.supplementQuantity === '' || !Number.isInteger(q) || q < 0 || q > need) errs[i.id] = `Giao thêm từ 0 đến ${need}`;
      else if (r.returnedQuantity === '' || !Number.isInteger(b) || b < 0 || b > back) errs[i.id] = `Lấy về từ 0 đến ${back}`;
      else if ((q < need || b < back) && !r.supplementNote.trim()) errs[i.id] = 'Làm chưa đủ: ghi lý do';
    });
    setRowErrors(errs);
    if (!signature) setSigError('Vui lòng chọn hoặc tải lên chữ ký');
    return Object.keys(errs).length === 0 && !!signature;
  };

  const askConfirm = () => {
    const ok = supplementMode ? validateSupplement() : validateHandover();
    if (ok) setConfirmOpen(true);
    else toast.error('Vui lòng kiểm tra lại số lượng, ghi chú và chữ ký');
  };

  const doConfirm = async () => {
    try {
      if (supplementMode) {
        await confirmSupplement(
          t.id,
          {
            items: supplementItems.map((i) => ({
              itemId: i.id,
              quantity: rows[i.id].supplementQuantity,
              returnedQuantity: rows[i.id].returnedQuantity,
              note: rows[i.id].supplementNote,
              images: rows[i.id].supplementImages,
            })),
            signatureUrl: signature,
          },
          user,
        );
        toast.success('Đã ghi nhận giao thêm / lấy lại. Người nhận sẽ kiểm tra và xác nhận.', 'Thành công');
      } else {
        await confirmHandover(t.id, { items: t.items.map((i) => ({ itemId: i.id, ...rows[i.id] })), signatureUrl: signature, note }, user);
        toast.success(`Đã bàn giao phiếu ${t.code}. Người nhận đã được thông báo.`, 'Bàn giao thành công');
      }
      setConfirmOpen(false);
      reload({ silent: true });
    } catch (err) {
      setConfirmOpen(false);
      toast.error(err.message, 'Không thể xác nhận');
    }
  };

  const doRequestRevision = async (reason) => {
    try {
      await requestTransferRevision(t.id, reason, user);
      toast.success('Đã gửi yêu cầu điều chỉnh tới Phó hiệu trưởng', 'Yêu cầu điều chỉnh');
      setAdjustOpen(false);
      reload({ silent: true });
    } catch (err) {
      toast.error(err.message);
    }
  };

  const diffCount = t.items.filter((i) => Number(rows[i.id]?.handoverQuantity) !== i.quantity).length;
  const showSignaturePicker = actionable || supplementMode;
  const discrepancyCard = t.discrepancies.length > 0 && (
    <div className="mt-16">
      <DiscrepancyHistoryCard transfer={t} md={md} />
    </div>
  );

  return (
    <div className="page">
      <Breadcrumb items={transferCrumbs(`Bàn giao tài sản - ${t.code}`)} />
      <div className="page__head">
        <div>
          <h1 className="page__title" style={{ marginBottom: 8 }}>
            Bàn giao tài sản - {t.code}
          </h1>
          <TransferStatusBadge status={t.status} size="lg" />
        </div>
        <div style={{ marginTop: 8 }}>
          <TransferPrintButtons transfer={t} md={md} />
        </div>
      </div>

      {openDiscrepancy ? (
        <div className="alert alert--purple mt-16">
          <Scale size={18} />
          <div>
            <b>Người nhận {md.userById(openDiscrepancy.reportedBy)?.fullName} báo chênh lệch</b> lúc{' '}
            {formatDateTime(openDiscrepancy.reportedAt)}: “{openDiscrepancy.description}”. Phó hiệu trưởng đang xử lý; nếu cần giao thêm
            hoặc lấy lại, bạn sẽ nhận thông báo.
          </div>
        </div>
      ) : supplementMode ? (
        <div className="alert alert--warning mt-16">
          <PackagePlus size={18} />
          <div>
            <b>Cần giao thêm / lấy lại</b> theo xử lý chênh lệch của PHT
            {lastResolved ? ` (${formatDateTime(lastResolved.resolution.resolvedAt)}): ${lastResolved.resolution.note}` : ''}
            <div>Chỉ làm đúng các dòng trong bảng “Giao thêm / lấy lại”, không cần bàn giao lại cả phiếu.</div>
          </div>
        </div>
      ) : actionable ? (
        <div className="alert alert--info mt-16">
          <Info size={18} />
          <div>
            Nếu phiếu chưa đúng, chọn “<b>Yêu cầu điều chỉnh</b>” để gửi lại cho Phó hiệu trưởng chỉnh sửa. Nếu thông tin và tài sản đúng,
            chọn “<b>Xác nhận bàn giao</b>”.
          </div>
        </div>
      ) : (
        <div className="alert alert--success mt-16">
          <Info size={18} />
          <div>
            {t.status === TRANSFER_STATUS.REVISION_REQUESTED && 'Bạn đã yêu cầu điều chỉnh. Phiếu đang chờ Phó hiệu trưởng sửa và gửi lại.'}
            {handoverSig && `Bạn đã ký bàn giao lúc ${formatDateTime(handoverSig.signedAt)}. `}
            {t.status === TRANSFER_STATUS.PENDING_RECEIPT && 'Đang chờ người nhận kiểm tra và xác nhận.'}
            {t.status === TRANSFER_STATUS.COMPLETED && 'Phiếu đã hoàn thành.'}
            {t.status === TRANSFER_STATUS.CANCELLED && 'Phiếu đã bị hủy.'}
          </div>
        </div>
      )}

      <div className="mt-16">
        <TransferInfoCard transfer={t} md={md} myRole={getMyTransferRole(t, user)} />
      </div>

      {supplementMode && (
        <div className="card card--soft-header mt-16">
          <div className="card__header">
            <div className="card__title">
              <PackagePlus size={20} /> Giao thêm / lấy lại
            </div>
          </div>
          <div className="card__body">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tài sản</th>
                    <th className="center">Cần giao thêm</th>
                    <th className="center">Đã giao thêm</th>
                    <th className="center">Cần lấy về (giao thừa)</th>
                    <th className="center">Đã lấy về</th>
                    <th>Ghi chú</th>
                    <th className="center">Ảnh</th>
                  </tr>
                </thead>
                <tbody>
                  {supplementItems.map((i) => {
                    const r = rows[i.id] || {};
                    const err = rowErrors[i.id];
                    return (
                      <tr key={i.id}>
                        <td>
                          <div className="fw-600">{i.assetName}</div>
                          <div className="muted text-xs">{i.assetCode}</div>
                        </td>
                        <td className="center fw-600 text-danger">{i.supplementRequired || '—'}</td>
                        <td className="center" style={{ width: 120 }}>
                          {i.supplementRequired > 0 ? (
                            <input
                              type="number"
                              min={0}
                              max={i.supplementRequired}
                              className={`input qty-input ${err ? 'input--error' : ''}`}
                              value={r.supplementQuantity ?? ''}
                              onChange={(e) => setRow(i.id, { supplementQuantity: e.target.value === '' ? '' : Number(e.target.value) })}
                              aria-label={`Số lượng giao thêm ${i.assetName}`}
                            />
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="center fw-600 text-danger">{i.returnRequired || '—'}</td>
                        <td className="center" style={{ width: 120 }}>
                          {i.returnRequired > 0 ? (
                            <input
                              type="number"
                              min={0}
                              max={i.returnRequired}
                              className={`input qty-input ${err ? 'input--error' : ''}`}
                              value={r.returnedQuantity ?? ''}
                              onChange={(e) => setRow(i.id, { returnedQuantity: e.target.value === '' ? '' : Number(e.target.value) })}
                              aria-label={`Số lượng lấy về ${i.assetName}`}
                            />
                          ) : (
                            '—'
                          )}
                          {err && <div className="field__error text-xs">{err}</div>}
                        </td>
                        <td style={{ minWidth: 200 }}>
                          <input
                            className="input"
                            placeholder="Ghi chú..."
                            value={r.supplementNote || ''}
                            onChange={(e) => setRow(i.id, { supplementNote: e.target.value })}
                            aria-label={`Ghi chú giao bổ sung ${i.assetName}`}
                          />
                        </td>
                        <td className="center">
                          <ImageUploader images={r.supplementImages} onChange={(imgs) => setRow(i.id, { supplementImages: imgs })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="card card--soft-header mt-16">
        <div className="card__header">
          <div className="card__title">
            <List size={20} /> {actionable ? 'Danh sách tài sản cần bàn giao' : 'Danh sách tài sản đã bàn giao'}
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
                  <th className="center">Số lượng theo phiếu</th>
                  <th className="center">Số lượng bàn giao</th>
                  <th className="center">Tình trạng</th>
                  <th>Ghi chú</th>
                  <th className="center">Hình ảnh</th>
                </tr>
              </thead>
              <tbody>
                {t.items
                  .filter((i) => i.quantity > 0)
                  .map((i, idx) => {
                    const r = rows[i.id] || {};
                    const err = actionable ? rowErrors[i.id] : null;
                    const supplied = (i.supplementHistory || []).reduce((s, x) => s + (x.quantity || 0), 0);
                    return (
                      <tr key={i.id}>
                        <td className="center">{idx + 1}</td>
                        <td>{i.assetCode}</td>
                        <td>
                          {i.assetName}
                          {supplied > 0 && <div className="text-primary text-xs">Đã giao thêm {supplied}</div>}
                        </td>
                        <td className="center">{i.quantity}</td>
                        <td className="center" style={{ width: 150 }}>
                          {actionable ? (
                            <>
                              <input
                                type="number"
                                min={0}
                                max={i.quantity}
                                className={`input qty-input ${err ? 'input--error' : ''}`}
                                value={r.handoverQuantity ?? ''}
                                onChange={(e) => setRow(i.id, { handoverQuantity: e.target.value === '' ? '' : Number(e.target.value) })}
                                aria-label={`Số lượng bàn giao ${i.assetName}`}
                              />
                              {err && <div className="field__error text-xs">{err}</div>}
                            </>
                          ) : (
                            (i.handoverQuantity ?? '—')
                          )}
                        </td>
                        <td className="center" style={{ width: 160 }}>
                          {actionable ? (
                            <ConditionSelect value={r.handoverCondition} onChange={(v) => setRow(i.id, { handoverCondition: v })} />
                          ) : (
                            <ConditionBadge value={i.handoverCondition || i.condition} />
                          )}
                        </td>
                        <td style={{ minWidth: 180 }}>
                          {actionable ? (
                            <input
                              className="input"
                              placeholder="Ghi chú..."
                              value={r.handoverNote || ''}
                              onChange={(e) => setRow(i.id, { handoverNote: e.target.value })}
                              aria-label={`Ghi chú ${i.assetName}`}
                            />
                          ) : (
                            i.handoverNote || '—'
                          )}
                        </td>
                        <td className="center">
                          <ImageUploader
                            images={actionable ? r.handoverImages : i.handoverImages}
                            onChange={(imgs) => setRow(i.id, { handoverImages: imgs })}
                            disabled={!actionable}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {actionable && diffCount > 0 && (
            <div className="alert alert--warning mt-12">
              <AlertCircle size={18} />
              <div>
                Có {diffCount} tài sản bàn giao khác số lượng theo phiếu. Nếu phiếu ghi sai, nên dùng “Yêu cầu điều chỉnh” để PHT sửa phiếu
                trước khi ký.
              </div>
            </div>
          )}
        </div>
      </div>

      {discrepancyCard}
      <div className="mt-16">
        <StockMovementCard transfer={t} md={md} />
      </div>
      <div className="mt-16">
        <TransferSignaturesCard transfer={t} md={md} highlightUserId={user.id} />
      </div>

      {showSignaturePicker && (
        <div className="split-2 mt-16">
          <div className="card card--soft-header">
            <div className="card__header">
              <div className="card__title">
                <UserRound size={20} /> Chữ ký của tôi
              </div>
            </div>
            <div className="card__body">
              <SignaturePicker variant="compact" value={signature} onChange={onSignature} error={sigError} />
            </div>
          </div>
          {actionable ? (
            <div className="card card--soft-header">
              <div className="card__header">
                <div className="card__title">
                  <FileText size={20} /> Lý do yêu cầu điều chỉnh / Ghi chú
                </div>
              </div>
              <div className="card__body">
                <textarea
                  className="textarea"
                  rows={4}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Nhập lý do nếu phiếu cần PHT điều chỉnh lại (ví dụ: sai tài sản, thiếu số lượng, sai lớp/phòng)."
                  aria-label="Lý do yêu cầu điều chỉnh / Ghi chú"
                />
                <div className="char-count">{note.length}/500</div>
              </div>
            </div>
          ) : (
            <div />
          )}
        </div>
      )}

      <div className="page-actions">
        <button className="btn btn--lg" onClick={() => navigate('/facility/transfers')}>
          <ArrowLeft size={17} /> Quay lại
        </button>
        {actionable && (
          <div className="row" style={{ gap: 12 }}>
            <button className="btn btn--lg btn--warning" onClick={() => setAdjustOpen(true)}>
              <AlertCircle size={18} /> Yêu cầu điều chỉnh
            </button>
            <button className="btn btn--lg btn--primary" onClick={askConfirm}>
              <Check size={18} /> Xác nhận bàn giao
            </button>
          </div>
        )}
        {supplementMode && (
          <button className="btn btn--lg btn--primary" onClick={askConfirm}>
            <PackagePlus size={18} /> Xác nhận giao thêm / lấy lại
          </button>
        )}
      </div>

      <AdjustmentRequestModal open={adjustOpen} initialReason={note} onSubmit={doRequestRevision} onClose={() => setAdjustOpen(false)} />
      <ConfirmationModal
        open={confirmOpen}
        title={supplementMode ? 'Xác nhận giao thêm / lấy lại?' : 'Xác nhận bàn giao tài sản?'}
        message={
          supplementMode
            ? `Bạn xác nhận đã giao thêm ${supplementItems.reduce((s, i) => s + (Number(rows[i.id]?.supplementQuantity) || 0), 0)} và lấy về ${supplementItems.reduce((s, i) => s + (Number(rows[i.id]?.returnedQuantity) || 0), 0)} tài sản. Người nhận sẽ kiểm tra và xác nhận.`
            : `Bạn xác nhận đã bàn giao ${t.items.reduce((s, i) => s + (Number(rows[i.id]?.handoverQuantity) || 0), 0)} tài sản thực tế. Chữ ký của bạn sẽ được lưu kèm thời gian ký và phiếu chuyển sang “Chờ xác nhận nhận”.`
        }
        confirmLabel={supplementMode ? 'Ký và xác nhận' : 'Ký và xác nhận bàn giao'}
        onConfirm={doConfirm}
        onClose={() => setConfirmOpen(false)}
      >
        {signature && (
          <div className="sig-box mt-12">
            <img src={signature} alt="Chữ ký sẽ dùng" />
          </div>
        )}
      </ConfirmationModal>
    </div>
  );
}
