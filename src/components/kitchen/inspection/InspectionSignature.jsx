import { useState } from 'react';
import { Button, Modal } from '@/components';
import { Info, PenLine } from '@/components/ui/icons';
import { SignaturePicker } from '@/components/signature/SignaturePicker';
import { INSPECTION_HAND_SIGN_LABELS } from '@/models/kitchen/inspectionConstants';
import { hasValidSignature } from '@/utils/kitchen/inspectionForm';
import { formatDate, formatDateTime } from '@/utils/format';

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

/**
 * Hộp ký mẫu kiểm thực: dòng ngữ cảnh (mẫu · điểm trường · ngày · số dòng), khung nói ký xong thì sao, ô "Người kiểm tra" để chọn ảnh chữ ký.
 * `onConfirm(chữ ký)` trả true khi ký xong thì hộp tự đóng.
 */
export function InspectionSignDialog({ open, busy, formLabel, campusName, date, rowCount, onClose, onConfirm }) {
  const [chosen, setChosen] = useState({ url: null, id: null });
  const confirm = async () => {
    if (await onConfirm(chosen)) onClose();
  };
  return (
    <Modal
      open={open}
      title="Ký xác nhận mẫu kiểm thực"
      onClose={busy ? undefined : onClose}
      closeOnBackdrop={false}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            Hủy
          </Button>
          <Button variant="primary" icon={PenLine} loading={busy} disabled={!chosen.url} onClick={confirm}>
            Ký xác nhận
          </Button>
        </>
      }
    >
      <div className="kr-reopen">
        <p className="kr-reopen__ctx">
          <b>{formLabel}</b>
          {campusName && ` · ${campusName}`}
          {date && ` · ${formatDate(date)}`}
          {rowCount > 0 && ` · ${rowCount} dòng`}
        </p>
        <div className="alert alert--info kr-reopen__alert" role="note">
          <Info size={18} />
          <div>
            Ký xong:
            <ul>
              <li>Mẫu bị khóa, không sửa được ô nào.</li>
              <li>Ảnh chữ ký in ở ô Người kiểm tra cuối mẫu.</li>
              <li>Muốn sửa phải bấm Sửa lại, ghi lý do; chữ ký cũ mất hiệu lực và phải ký lại.</li>
            </ul>
          </div>
        </div>
        <section className="kr-sign-pick" aria-label="Chữ ký người kiểm tra">
          <div className="kr-sign-pick__head">
            <span className="fw-600">Người kiểm tra</span>
            <span className="text-xs muted">Chọn chữ ký đã lưu hoặc tải ảnh mới</span>
          </div>
          <SignaturePicker variant="compact" value={chosen.url} onChange={setChosen} disabled={busy} />
        </section>
      </div>
    </Modal>
  );
}
