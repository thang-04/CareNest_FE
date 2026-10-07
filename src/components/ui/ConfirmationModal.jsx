import { useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { Modal } from './Modal';
import { Spinner } from './States';

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
  const Icon = danger ? AlertTriangle : HelpCircle;
  return (
    <Modal
      open={open}
      title={title}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={handleConfirm} disabled={busy}>
            {busy && <Spinner small />} {confirmLabel}
          </button>
        </>
      }
    >
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <div
          className={`state__icon ${danger ? 'confirm-icon--danger' : ''}`}
          style={{ width: 44, height: 44, flexShrink: 0, ...(danger ? { background: 'var(--danger-50)', color: 'var(--danger)' } : {}) }}
        >
          <Icon size={22} />
        </div>
        <div style={{ lineHeight: 1.55, flex: 1 }}>
          {message}
          {children}
        </div>
      </div>
    </Modal>
  );
}
