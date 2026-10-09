import { useState } from 'react';
import { Question, Warning } from '@/components/ui/icons';
import { Modal } from './Modal';
import { SubmitOverlay } from './States';

/** Confirm dialog for important or destructive actions. `onConfirm` may be async. */
export function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Quay lại',
  danger = false,
  onConfirm,
  onClose,
  children,
}) {
  const [busy, setBusy] = useState(false);
  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm?.();
    } finally {
      setBusy(false);
    }
  };
  const Icon = danger ? Warning : Question;
  return (
    <Modal
      open={open}
      label={title}
      size="sm"
      className="modal--confirm"
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={handleConfirm} disabled={busy}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {/* Đang gửi: phủ cả hộp (một dấu hiệu duy nhất, nút không thêm spinner) */}
      {busy && <SubmitOverlay state="sending" />}
      <div className={`confirm__icon ${danger ? 'confirm__icon--danger' : ''}`} aria-hidden="true">
        <Icon size={28} />
      </div>
      <div className="confirm__title">{title}</div>
      <div className="confirm__msg">
        {message}
        {children}
      </div>
    </Modal>
  );
}
