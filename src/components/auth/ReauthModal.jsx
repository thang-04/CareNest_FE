import { useState } from 'react';
import { Button, FormField, Modal, PasswordInput, TextField } from '@/components';
import { AlertCircle, Info, LogIn } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { getRememberedLogin, SESSION_CONFLICT } from '@/services/authService';
import { loginErrorText } from '@/utils/auth/loginErrorText';
import { TakeoverConfirmModal } from './TakeoverConfirmModal';

/**
 * Phiên kết thúc khi màn còn thay đổi chưa lưu (AUTH-28: đăng nhập ở trình duyệt khác, hoặc hết hạn):
 * đăng nhập lại ngay trên màn để lưu tiếp, không mất dữ liệu đang nhập. "Thoát" thì về trang đăng nhập và bỏ thay đổi.
 */
export function ReauthModal() {
  const { user, sessionMessage, reauthenticate, reauthConfirmTakeover, endSession } = useAuth();
  const [takeover, setTakeover] = useState(null);
  const [identifier, setIdentifier] = useState(() => getRememberedLogin() || user?.phone || user?.email || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Vui lòng nhập SĐT/email và mật khẩu');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await reauthenticate({ email: identifier.trim(), password, remember: true }); // carenest:allow-secret – tên field, không phải giá trị bí mật
    } catch (err) {
      // AUTH-28: tài khoản đang dùng ở trình duyệt khác ⇒ hỏi dùng ở đâu
      if (err.errorCode === SESSION_CONFLICT) {
        setTakeover({ expiresAt: err.details?.takeover?.expiresAt });
        setPassword('');
        return;
      }
      // Mật khẩu tạm cần đổi trước: không làm được trong hộp này
      setError(err.details?.passwordChangeRequired ? 'Tài khoản cần đổi mật khẩu, hãy thoát và đăng nhập lại' : loginErrorText(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  if (takeover)
    return (
      <TakeoverConfirmModal
        expiresAt={takeover.expiresAt}
        onConfirm={() => reauthConfirmTakeover({ remember: true })}
        onClose={() => setTakeover(null)}
      />
    );

  return (
    <Modal
      open
      label="Đăng nhập lại"
      size="sm"
      closeOnBackdrop={false}
      footer={
        <>
          <Button onClick={() => endSession(sessionMessage)} disabled={busy}>
            Thoát (bỏ thay đổi)
          </Button>
          <Button variant="primary" type="submit" form="reauth-form" loading={busy} icon={LogIn}>
            Đăng nhập lại
          </Button>
        </>
      }
    >
      <form id="reauth-form" className="auth-form" onSubmit={submit} noValidate>
        <div className="alert alert--warning">
          <Info size={18} />
          <div>{sessionMessage}. Dữ liệu đang nhập trên màn này vẫn được giữ — đăng nhập lại để lưu tiếp.</div>
        </div>
        {error && (
          <div className="alert alert--danger" role="alert">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}
        <TextField
          label="SĐT hoặc email"
          required
          type="text"
          maxLength={255}
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <FormField label="Mật khẩu" required>
          <PasswordInput
            autoComplete="current-password"
            autoFocus
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
      </form>
    </Modal>
  );
}
