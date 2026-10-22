import { Modal } from '@/components/ui/Modal';
import { SubmitOverlay } from '@/components/ui/States';
import { Warning } from '@/components/ui/icons';

/** Hỏi khi rời trang / chuyển tab còn thay đổi chưa lưu: Hủy · Không lưu · Lưu (props từ useLeaveGuard().modal). */
export function LeaveConfirmModal({
  open,
  busy,
  onStay,
  onDiscard,
  onSaveAndLeave,
  canSave = true,
  message = 'Bạn chưa lưu các thay đổi trên trang này. Rời trang thì các thay đổi sẽ bị mất.',
}) {
  return (
    <Modal
      open={open}
      label="Có thay đổi chưa lưu"
      size="sm"
      className="modal--confirm"
      onClose={busy ? undefined : onStay}
      footer={
        <>
          <button type="button" className="btn" onClick={onStay} disabled={busy}>
            Hủy
          </button>
          <button type="button" className="btn btn--danger" onClick={onDiscard} disabled={busy}>
            Không lưu
          </button>
          {canSave && (
            <button type="button" className="btn btn--primary" onClick={onSaveAndLeave} disabled={busy}>
              Lưu
            </button>
          )}
        </>
      }
    >
      {busy && <SubmitOverlay state="sending" />}
      <div className="confirm__icon confirm__icon--danger" aria-hidden="true">
        <Warning size={28} />
      </div>
      <div className="confirm__title">Có thay đổi chưa lưu</div>
      <div className="confirm__msg">{message}</div>
    </Modal>
  );
}
