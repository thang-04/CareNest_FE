import { useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { FormField } from '@/components/form/FormField';
import { Spinner } from '@/components/ui/States';
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
      <FormField label="Giờ trả đúng" required error={errors.handoverTime}>
        <input
          className="input"
          type="time"
          value={form.handoverTime}
          onChange={(e) => setForm({ ...form, handoverTime: e.target.value })}
        />
      </FormField>
      <FormField label="Lý do sửa" required error={errors.reason} className="mt-12">
        <textarea
          className="textarea"
          rows={3}
          maxLength={500}
          value={form.reason}
          onChange={(e) => setForm({ ...form, reason: e.target.value })}
        />
      </FormField>
      <div className="dt-call__actions mt-16">
        <button className="btn btn--primary" onClick={save} disabled={busy}>
          {busy ? <Spinner small /> : <Save size={16} />} Lưu giờ trả
        </button>
      </div>
    </section>
  );
}
