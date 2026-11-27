import { useState } from 'react';
import { Button, Modal, TextAreaField, TextField } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { requestPhoneChange } from '@/services/account/guardianService';
import { isValidPhone, normalizePhone } from '@/utils/children/childrenValidation';

export function PhoneChangeModal({ childId, guardian, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [newPhone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    const next = {};
    if (!isValidPhone(newPhone)) next.newPhone = 'Nhập số điện thoại gồm 10 chữ số, bắt đầu bằng 0.';
    if (!reason.trim() || reason.trim().length > 300) next.reason = 'Nhập lý do đổi số (tối đa 300 ký tự).';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await requestPhoneChange(childId, guardian.id, { newPhone: normalizePhone(newPhone), reason: reason.trim() }, user);
      toast.success('Đã gửi yêu cầu đổi số điện thoại. Hồ sơ giữ số cũ tới khi được duyệt.');
      onClose();
    } catch (err) {
      setErrors(err.details || {});
      toast.error(err, 'Không gửi được yêu cầu');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open title="Yêu cầu đổi số điện thoại" onClose={() => !busy && onClose()}
      footer={<Button variant="primary" loading={busy} onClick={submit}>Gửi yêu cầu</Button>}>
      <p>{guardian.fullName} · Số hiện tại {guardian.savedPhone}</p>
      <TextField label="Số điện thoại mới" required type="tel" value={newPhone} error={errors.newPhone} onChange={(e) => setPhone(e.target.value)} />
      <TextAreaField label="Lý do" required maxLength={300} value={reason} error={errors.reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}
