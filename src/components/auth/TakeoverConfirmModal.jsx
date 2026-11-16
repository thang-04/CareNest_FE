import { useState } from 'react';
import { Button, Modal, SubmitOverlay } from '@/components';
import { AlertTriangle, Clock, LogIn, Monitor, X } from '@/components/ui/icons';
import { cancelTakeover, TAKEOVER_EXPIRED, TAKEOVER_REJECTED } from '@/services/authService';
import { formatTime } from '@/utils/format';
import { loginErrorText } from '@/utils/auth/loginErrorText';
import { SessionChoices } from './SessionChoices';

const CHOICES = [
  {
    icon: LogIn,
    title: 'Dùng ở đây',
    description: 'Trình duyệt kia bị đăng xuất ngay. Nội dung chưa lưu ở đó có thể mất.',
    primary: true,
  },
  {
    icon: X,
    title: 'Hủy',
    description: 'Không đăng nhập ở đây, trình duyệt kia dùng tiếp bình thường. Chọn khi bạn mở nhầm.',
  },
];

/**
 * AUTH-28 (trình duyệt vừa đăng nhập): tài khoản đang dùng ở trình duyệt khác ⇒ người dùng chọn dùng ở đâu.
 * Chưa chọn thì trình duyệt kia không bị đăng xuất; mở nhầm thì "Hủy".
 */
export function TakeoverConfirmModal({ expiresAt, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Phiên kia đã chọn ở lại hoặc hết 2 phút chờ: lượt này đã bị hủy ở BE, chỉ còn đăng nhập lại
  const ended = [TAKEOVER_REJECTED, TAKEOVER_EXPIRED].includes(error?.errorCode);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  };

  const close = async () => {
    setBusy(true);
    if (!ended) await cancelTakeover();
    onClose();
  };

  if (ended)
    return (
      <Modal
        open
        label="Chưa đăng nhập được ở đây"
        size="sm"
        className="modal--confirm"
        closeOnBackdrop={false}
        onClose={onClose}
        footer={
          <Button variant="primary" onClick={onClose}>
            Đăng nhập lại
          </Button>
        }
      >
        <div className="confirm__icon confirm__icon--danger" aria-hidden="true">
          <AlertTriangle size={28} />
        </div>
        <div className="confirm__title">Chưa đăng nhập được ở đây</div>
        <div className="confirm__msg">{loginErrorText(error)}</div>
      </Modal>
    );

  return (
    <Modal
      open
      label="Tài khoản đang mở ở trình duyệt khác"
      size="sm"
      className="modal--confirm"
      closeOnBackdrop={false}
      onClose={busy ? undefined : close}
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            Hủy
          </Button>
          <Button variant="primary" onClick={confirm} disabled={busy}>
            Dùng ở đây
          </Button>
        </>
      }
    >
      {busy && <SubmitOverlay state="sending" />}
      <div className="confirm__icon" aria-hidden="true">
        <Monitor size={28} />
      </div>
      <div className="confirm__title">Tài khoản đang mở ở trình duyệt khác</div>
      <div className="confirm__msg">Mỗi tài khoản chỉ dùng được ở một nơi. Bạn muốn dùng ở đâu?</div>
      <SessionChoices items={CHOICES} />
      {expiresAt && (
        <div className="confirm__hint row row--center gap-1">
          <Clock size={16} aria-hidden="true" /> Chọn trước {formatTime(expiresAt)}, sau đó cần đăng nhập lại.
        </div>
      )}
      {error && (
        <div className="alert alert--danger mt-12" role="alert">
          {loginErrorText(error)}
        </div>
      )}
    </Modal>
  );
}
