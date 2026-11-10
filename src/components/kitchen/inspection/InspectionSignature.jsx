import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { SignaturePicker } from '@/components/signature/SignaturePicker';
import { INSPECTION_HAND_SIGN_LABELS } from '@/models/kitchen/inspectionConstants';
import { hasValidSignature } from '@/utils/kitchen/inspectionForm';
import { formatDateTime } from '@/utils/format';

/**
 * Ba ô ký cuối mẫu: PHT ký ảnh ở ô "Người kiểm tra"; hai ô còn lại để trống, ký tay sau khi in.
 * Chưa ký hoặc chữ ký hết hiệu lực hiện "Chưa xác nhận".
 */
export function InspectionSignBoxes({ tab, data }) {
  const valid = hasValidSignature(data);
  const sig = data.signature;
  const hand = INSPECTION_HAND_SIGN_LABELS[tab];
  return (
    <div className="kr-sign__row">
      <div className="kr-sign__box">
        <div className="fw-600">{hand[0]}</div>
        <div className="muted text-xs">(Ký, họ tên)</div>
      </div>
      <div className="kr-sign__box">
        <div className="fw-600">Người kiểm tra</div>
        <div className="muted text-xs">(Ký, họ tên)</div>
        {valid ? (
          <>
            <img className="kr-sign__img" src={sig.imageUrl} alt={`Chữ ký ${sig.signedByName}`} />
            <div>{sig.signedByName}</div>
            <div className="muted text-xs">Ký lúc {formatDateTime(sig.signedAt)}</div>
          </>
        ) : (
          <div className="muted text-sm kr-sign__empty">Chưa xác nhận</div>
        )}
      </div>
      <div className="kr-sign__box">
        <div className="fw-600">{hand[1]}</div>
        <div className="muted text-xs">(Ký, họ tên)</div>
      </div>
    </div>
  );
}

/** Hộp chọn ảnh chữ ký để ký; `onConfirm(chữ ký)` trả true khi ký xong thì hộp tự đóng. */
export function InspectionSignDialog({ open, busy, onClose, onConfirm }) {
  const [chosen, setChosen] = useState({ url: null, id: null });
  const confirm = async () => {
    if (await onConfirm(chosen)) onClose();
  };
  return (
    <Modal
      open={open}
      title="Ký xác nhận mẫu kiểm thực"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn btn--primary" disabled={busy || !chosen.url} onClick={confirm}>
            Ký xác nhận
          </button>
        </>
      }
    >
      <p className="text-sm">Ảnh chữ ký được lưu kèm mẫu này. Sửa nội dung sau khi ký thì chữ ký mất hiệu lực và phải ký lại.</p>
      <SignaturePicker variant="compact" value={chosen.url} onChange={setChosen} />
    </Modal>
  );
}
