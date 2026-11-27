import { useRef, useState } from 'react';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { resendActivationCode } from '@/services/account/guardianService';

export function useActivationCode() {
  const { user } = useAuth();
  const toast = useToast();
  const pending = useRef(false);
  const [confirmId, setConfirmId] = useState(null);
  const resend = (id) => setConfirmId(id);
  const send = async (id) => {
    if (pending.current) return;
    pending.current = true;
    try {
      const result = await resendActivationCode(id, user);
      if (result.smsStatus === 'SENT') toast.success(`Đã gửi lại mã kích hoạt qua SMS tới ${result.username}.`);
      else toast.warning('Chưa gửi được SMS mã kích hoạt. Thử gửi lại sau.', 'Gửi SMS lỗi');
    } catch (err) {
      toast.error(err, 'Không gửi lại được mã kích hoạt');
    } finally {
      pending.current = false;
      setConfirmId(null);
    }
  };
  const dialog = confirmId != null && <ConfirmationModal open title="Gửi lại mã kích hoạt?" message="Hệ thống tạo mã kích hoạt mới và gửi qua SMS. Mã kích hoạt trước đó sẽ hết hiệu lực." confirmLabel="Gửi lại mã" onConfirm={() => send(confirmId)} onClose={() => !pending.current && setConfirmId(null)} />;
  return { resend, dialog };
}
