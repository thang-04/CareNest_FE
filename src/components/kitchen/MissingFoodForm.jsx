import { useMemo, useState } from 'react';
import { PackageMinus } from '@/components/ui/icons';
import { FormField, Modal, SearchSelect, Spinner } from '@/components';
import { validateMissingFood } from '@/utils/kitchen/kitchenValidation';
import { MEAL_SESSIONS, MEAL_SESSION_LABELS, NOTE_MAX } from '@/models/kitchen/kitchenConstants';
import { todayInput } from '@/utils/format';

/** UC 6.19 form: ingredient, affected quantity, meal or date and a shortage description. */
export function MissingFoodForm({ open, foods, initial, onClose, onSubmit }) {
  const [form, setForm] = useState(() => ({ date: todayInput(), session: '', foodId: '', quantity: '', description: '', ...initial }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const options = useMemo(() => foods.map((f) => ({ value: f.id, label: `${f.name} (${f.unit})` })), [foods]);
  const unit = foods.find((f) => f.id === form.foodId)?.unit || '';

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = async () => {
    const found = validateMissingFood(form, todayInput());
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      await onSubmit(form);
    } catch (err) {
      if (err.details) setErrors(err.details);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Báo thiếu thực phẩm"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={saving}>
            {saving ? <Spinner small /> : <PackageMinus size={16} />} Gửi báo thiếu
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="grid-2">
          <FormField label="Ngày cần thực phẩm" required error={errors.date}>
            <input type="date" className="input" min={todayInput()} value={form.date} onChange={(e) => set('date', e.target.value)} />
          </FormField>
          <FormField label="Bữa ăn" error={errors.session}>
            <select className="select" value={form.session} onChange={(e) => set('session', e.target.value)}>
              <option value="">Cả ngày</option>
              {MEAL_SESSIONS.map((s) => (
                <option key={s} value={s}>
                  {MEAL_SESSION_LABELS[s]}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div className="grid-2">
          <div className="field">
            <span className="field__label">
              Thực phẩm<span className="req">*</span>
            </span>
            <SearchSelect
              options={options}
              value={form.foodId}
              onChange={(v) => set('foodId', v)}
              placeholder="Chọn thực phẩm"
              error={!!errors.foodId}
              ariaLabel="Thực phẩm"
            />
            {errors.foodId && <div className="field__error">{errors.foodId}</div>}
          </div>
          <FormField label={`Số lượng thiếu${unit ? ` (${unit})` : ''}`} required error={errors.quantity}>
            <input
              type="number"
              min="0"
              step="any"
              className="input"
              value={form.quantity}
              onChange={(e) => set('quantity', e.target.value)}
            />
          </FormField>
        </div>
        <FormField label="Mô tả tình trạng thiếu" required error={errors.description} hint={`Tối đa ${NOTE_MAX} ký tự`}>
          <textarea
            className="textarea"
            rows={3}
            maxLength={NOTE_MAX}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </FormField>
      </div>
    </Modal>
  );
}
