import { useState } from 'react';
import { Button, Modal, SubmitOverlay } from '@/components';
import { Monitor, ShieldAlert, SignOut, Warning } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { hasUnsavedChanges } from '@/hooks/useLeaveGuard';
import { formatTime } from '@/utils/format';
import { SessionChoices } from './SessionChoices';

const CHOICES = [
  {
    icon: Monitor,
    title: 'Tiếp tục dùng ở đây',
    description: 'Lần đăng nhập ở trình duyệt kia bị hủy, bạn làm việc tiếp như bình thường.',
    primary: true,
  },
  {
    icon: SignOut,
    title: 'Đăng xuất ở đây',
    description: 'Nhường cho trình duyệt kia. Nội dung chưa lưu trên màn này sẽ mất.',
  },
];

const UNSAVED_CHOICES = [
  {
    icon: Monitor,
    title: 'Ở lại để lưu',
    description: 'Tiếp tục dùng ở đây và hủy lần đăng nhập kia. Lưu xong, bạn có thể đăng xuất rồi đăng nhập ở trình duyệt kia.',
    primary: true,
  },
  {
    icon: SignOut,
    title: 'Vẫn đăng xuất',
    description: 'Bỏ các thay đổi chưa lưu trên màn này và nhường cho trình duyệt kia.',
  },
];

/**
 * AUTH-28 (phiên đang dùng): trình duyệt khác vừa đăng nhập cùng tài khoản và đang chờ. "Tiếp tục dùng ở đây" hủy lần
 * đăng nhập kia; không chọn gì thì phiên này vẫn dùng bình thường cho tới khi bên kia chọn "Dùng ở đây".
 */
export function SessionTakeoverModal() {
  const { pendingTakeover, keepSessionHere, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Màn còn thay đổi chưa lưu mà chọn đăng xuất: hỏi lại trước khi bỏ
  const [confirmLeave, setConfirmLeave] = useState(false);

  const keep = async () => {
    setBusy(true);
    setError('');
    try {
      await keepSessionHere(pendingTakeover.id);
    } catch (err) {
      setError(err?.message || 'Không giữ được phiên, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  };

  const signOut = () => (hasUnsavedChanges() ? setConfirmLeave(true) : logout());

  const errorAlert = error && (
    <div className="alert alert--danger mt-12" role="alert">
      {error}
    </div>
  );

  if (confirmLeave)
    return (
      <Modal
        open
        label="Màn này còn thay đổi chưa lưu"
        size="sm"
        className="modal--confirm"
        closeOnBackdrop={false}
        footer={
          <>
            <Button variant="danger" onClick={() => logout()} disabled={busy}>
              Vẫn đăng xuất
            </Button>
            <Button variant="primary" onClick={keep} disabled={busy}>
              Ở lại để lưu
            </Button>
          </>
        }
      >
        {busy && <SubmitOverlay state="sending" />}
        <div className="confirm__icon confirm__icon--danger" aria-hidden="true">
          <Warning size={28} />
        </div>
        <div className="confirm__title">Màn này còn thay đổi chưa lưu</div>
        <div className="confirm__msg">Đăng xuất bây giờ thì các thay đổi chưa lưu sẽ mất.</div>
        <SessionChoices items={UNSAVED_CHOICES} />
        {errorAlert}
      </Modal>
    );

  return (
    <Modal
      open
      label="Tài khoản vừa đăng nhập ở nơi khác"
      size="sm"
      className="modal--confirm"
      closeOnBackdrop={false}
      footer={
        <>
          <Button onClick={signOut} disabled={busy}>
            Đăng xuất ở đây
          </Button>
          <Button variant="primary" onClick={keep} disabled={busy}>
            Tiếp tục dùng ở đây
          </Button>
        </>
      }
    >
      {busy && <SubmitOverlay state="sending" />}
      <div className="confirm__icon confirm__icon--danger" aria-hidden="true">
        <ShieldAlert size={28} />
      </div>
      <div className="confirm__title">Tài khoản vừa đăng nhập ở nơi khác</div>
      <div className="confirm__msg">
        Lúc <b>{formatTime(pendingTakeover.requestedAt)}</b>, một trình duyệt khác đăng nhập bằng tài khoản này và đang chờ bạn quyết định.
        Trong lúc chờ, bạn vẫn dùng bình thường.
      </div>
      <SessionChoices items={CHOICES} />
      <div className="confirm__hint">Không phải bạn? Chọn “Tiếp tục dùng ở đây” rồi đổi mật khẩu.</div>
      {errorAlert}
    </Modal>
  );
}
