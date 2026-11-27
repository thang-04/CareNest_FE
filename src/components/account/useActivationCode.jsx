import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { resendActivationCode } from '@/services/account/guardianService';
import { formatDateTime } from '@/utils/format';
import './activationCode.css';

export function useActivationCode() {
  const { user } = useAuth();
  const toast = useToast();
  const pending = useRef(false);
  const [slip, setSlip] = useState(null);
  const resend = async (id) => {
    if (pending.current) return;
    pending.current = true;
    try {
      const result = await resendActivationCode(id, user);
      if (result.activationCode) setSlip(result);
      else toast.success(`Đã gửi lại mã kích hoạt qua SMS tới ${result.username}.`);
    } catch (err) {
      toast.error(err, 'Không gửi lại được mã kích hoạt');
    } finally {
      pending.current = false;
    }
  };
  const dialog = slip && (
    <Modal
      open
      title="Phiếu kích hoạt"
      className="activation-slip"
      onClose={() => setSlip(null)}
      footer={<Button onClick={() => window.print()}>In phiếu</Button>}
    >
      <p>
        Mã kích hoạt: {slip.activationCode} · hết hạn {formatDateTime(slip.expiresAt)}
      </p>
    </Modal>
  );
  return { resend, dialog };
}
