import { useEffect, useState } from 'react';
import { MinusCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { MEAL_SESSIONS, MEAL_SESSION_LABELS } from '@/models/attendance/attendanceConstants';
import { validateMealCorrection } from '@/utils/attendance/attendanceValidation';

/** After the cut-off: cancel one meal of a child (never add one, GBR-ATT-08). The kitchen is notified. */
export function MealCorrectionModal({ open, child, record, onSubmit, onClose }) {
  const sessions = MEAL_SESSIONS.filter((s) => record?.meals?.[s]);
  const [form, setForm] = useState({ session: '', note: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ session: sessions.length === 1 ? sessions[0] : '', note: '' });
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    const errs = validateMealCorrection(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setErrors(err.details || {});
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Hủy suất ăn sau giờ khóa – ${child?.fullName || ''}`}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={busy}>
            Quay lại
          </button>
          <button className="btn btn--warning" onClick={submit} disabled={busy || sessions.length === 0}>
            {busy ? <Spinner small /> : <MinusCircle size={16} />} Hủy suất ăn
          </button>
        </>
      }
    >
      <div className="alert alert--info mb-12">
        Sau giờ khóa chỉ được <b>giảm</b> suất (ví dụ trẻ về sớm). Sĩ số được cập nhật và bếp nhận thông báo, không cần duyệt lại.
      </div>
      <FormField label="Bữa cần hủy" required error={errors.session}>
        <select className="select" value={form.session} onChange={(e) => setForm({ ...form, session: e.target.value })}>
          <option value="">Chọn bữa</option>
          {sessions.map((s) => (
            <option key={s} value={s}>
              {MEAL_SESSION_LABELS[s]}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Lý do" required error={errors.note} className="mt-12">
        <textarea
          className="textarea"
          rows={3}
          maxLength={300}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="Ví dụ: Trẻ sốt, phụ huynh đón lúc 9:30"
        />
      </FormField>
    </Modal>
  );
}
