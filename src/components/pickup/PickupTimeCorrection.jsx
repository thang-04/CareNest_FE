import { useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { TextAreaField, TextField } from '@/components/form/Field';
import { Button } from '@/components/ui/Button';
import { correctHandoverTime } from '@/services/pickup/pickupService';

const toInput = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '');

/** PCK-04: sửa giờ trả trong ngày, bắt buộc lý do; BE tính lại chuyên cần, suất ăn giữ nguyên và báo lại phụ huynh. */
export function PickupTimeCorrection({ pickup, onDone }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ handoverTime: toInput(pickup.handedOverAt), reason: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const found = {};
    if (!form.handoverTime) found.handoverTime = 'Nhập giờ trả trẻ (HH:mm).';
    if (!form.reason.trim()) found.reason = 'Nhập lý do sửa giờ trả.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await correctHandoverTime({ pickupId: pickup.id, handoverTime: form.handoverTime, reason: form.reason.trim() }, user);
      toast.success('Đã sửa giờ trả và báo lại phụ huynh.', 'Cập nhật thành công');
      onDone?.();
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không sửa được giờ trả');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Sửa giờ trả trẻ">
      <TextField
        label="Giờ trả đúng"
        required
        error={errors.handoverTime}
        type="time"
        value={form.handoverTime}
        onChange={(e) => setForm({ ...form, handoverTime: e.target.value })}
      />
      <TextAreaField
        label="Lý do sửa"
        required
        error={errors.reason}
        fieldClassName="mt-12"
        rows={3}
        maxLength={500}
        value={form.reason}
        onChange={(e) => setForm({ ...form, reason: e.target.value })}
      />
      <div className="dt-call__actions mt-16">
        <Button variant="primary" icon={Save} loading={busy} onClick={save}>
          Lưu giờ trả
        </Button>
      </div>
    </section>
  );
}
