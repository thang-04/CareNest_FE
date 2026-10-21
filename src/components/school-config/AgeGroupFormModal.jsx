import { useEffect, useState } from 'react';
import { Info, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { saveAgeGroup } from '@/services/school-config/schoolConfigService';
import { MEAL_SESSION_LABELS, MEAL_SESSION_OPTIONS } from '@/models/school-config/schoolConfigConstants';
import { validateAgeGroup, hasErrors } from '@/utils/school-config/schoolConfigValidation';

const EMPTY = {
  name: '',
  shortName: '',
  ageFromMonths: '',
  ageToMonths: '',
  mealSessions: ['LUNCH', 'AFTERNOON'],
  maxClassSize: 25,
  nutritionNote: '',
};

/** Age Group Form (SRS 4.1.4). The team leader is assigned on the Teacher Assignment screen, not here. */
export function AgeGroupFormModal({ open, onClose, group, existing, classes = [], yearName }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(group ? { ...EMPTY, ...group } : EMPTY);
    setErrors({});
  }, [open, group]);

  const used = group ? classes.filter((c) => c.ageGroupId === group.id) : [];
  const usedCampuses = new Set(used.map((c) => c.campusId)).size;

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };
  const others = existing.filter((g) => g.id !== group?.id);
  const toggleMeal = (s) =>
    set({ mealSessions: form.mealSessions.includes(s) ? form.mealSessions.filter((x) => x !== s) : [...form.mealSessions, s] });
  // Đổi bữa của nhóm đang có lớp: cảnh báo áp dụng từ nay, dữ liệu cũ giữ nguyên
  const mealsChanged = !!group && [...(group.mealSessions || [])].sort().join(',') !== [...form.mealSessions].sort().join(',');
  // Màn hình biết lớp của năm đang chọn; mock/BE kiểm tra lại trên mọi năm chưa kết thúc
  const check = () => validateAgeGroup(form, others, { blockingClasses: used });
  const blurCheck = (field) => {
    const e = check();
    if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };

  const submit = async () => {
    const e = check();
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      await saveAgeGroup(group?.id || null, form, user);
      toast.success('Đã lưu thay đổi.', group ? 'Cập nhật nhóm tuổi' : 'Thêm nhóm tuổi');
      onClose(true);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Không lưu được thay đổi');
    } finally {
      setSaving(false);
    }
  };

  const numberField = (field, label, { min, max, hint } = {}) => (
    <FormField label={label} required error={errors[field]} hint={hint}>
      <input
        className="input"
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={form[field]}
        onChange={(e) => set({ [field]: e.target.value })}
        onBlur={() => blurCheck(field)}
      />
    </FormField>
  );

  return (
    <Modal
      open={open}
      title={group ? `Sửa nhóm tuổi ${group.shortName}` : 'Thêm nhóm tuổi'}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={saving}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu nhóm tuổi
          </button>
        </>
      }
    >
      <div className="grid-2">
        <FormField label="Tên nhóm tuổi" required error={errors.name}>
          <input
            className="input"
            value={form.name}
            maxLength={50}
            onChange={(e) => set({ name: e.target.value })}
            onBlur={() => blurCheck('name')}
          />
        </FormField>
        <FormField label="Tên ngắn" required error={errors.shortName}>
          <input className="input" value={form.shortName} maxLength={40} onChange={(e) => set({ shortName: e.target.value })} />
        </FormField>
        {numberField('ageFromMonths', 'Độ tuổi từ (tháng)', { min: 0, max: 72 })}
        {numberField('ageToMonths', 'Độ tuổi đến (tháng)', { min: 1, max: 72 })}
        <fieldset className="field sc-meals">
          <legend className="field__label">
            Bữa ăn trong ngày<span className="req">*</span>
          </legend>
          <div className="sc-meals__options">
            {MEAL_SESSION_OPTIONS.map((s) => (
              <label key={s} className={`sc-meal ${form.mealSessions.includes(s) ? 'sc-meal--on' : ''}`}>
                <input type="checkbox" checked={form.mealSessions.includes(s)} onChange={() => toggleMeal(s)} />
                {MEAL_SESSION_LABELS[s]}
              </label>
            ))}
          </div>
          {errors.mealSessions ? (
            <span className="field__error" role="alert">
              {errors.mealSessions}
            </span>
          ) : null}
        </fieldset>
        {numberField('maxClassSize', 'Sĩ số tối đa / lớp', { min: 1 })}
      </div>
      <FormField label="Yêu cầu dinh dưỡng" className="mt-12">
        <textarea
          className="textarea"
          rows={2}
          maxLength={500}
          value={form.nutritionNote}
          onChange={(e) => set({ nutritionNote: e.target.value })}
        />
      </FormField>
      {mealsChanged && used.length > 0 && (
        <div className="alert alert--warning mt-12">
          <Info size={18} />
          <div>
            Nhóm đang có {used.length} lớp trong năm học {yearName}. Thực đơn và suất ăn từ hôm nay sẽ theo danh sách bữa mới; dữ liệu đã
            ghi trước đó giữ nguyên.
          </div>
        </div>
      )}
      {group && (
        <p className="text-sm text-2 mt-12">
          Đang dùng trong năm học {yearName}: <b>{used.length} lớp</b> · {usedCampuses} điểm trường
        </p>
      )}
    </Modal>
  );
}
