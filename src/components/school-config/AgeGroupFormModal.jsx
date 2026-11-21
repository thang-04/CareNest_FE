import { useEffect, useState } from 'react';
import { Info, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { TextField } from '@/components/form/Field';
import { getAgeGroupCatalog, saveAgeGroup } from '@/services/school-config/schoolConfigService';
import { MEAL_SESSION_LABELS, MEAL_SESSION_OPTIONS } from '@/models/school-config/schoolConfigConstants';
import { validateAgeGroup, hasErrors, errorsAfterChange, AGE_GROUP_LIMITS } from '@/utils/school-config/schoolConfigValidation';

const EMPTY = {
  standardAgeGroupId: '',
  name: '',
  shortName: '',
  ageFromMonths: '',
  ageToMonths: '',
  mealSessions: ['LUNCH', 'AFTERNOON'],
  maxClassSize: 25,
  nutritionNote: '',
};

/** Age Group Form (SRS 4.1.4). The team leader is assigned on the Teacher Assignment screen, not here. */
export function AgeGroupFormModal({ open, onClose, group, existing, classes = [], yearId, yearName }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCatalogLoading(true);
    getAgeGroupCatalog()
      .then((rows) => {
        setCatalog(rows || []);
        const standard = (rows || []).find((item) => String(item.id) === String(group?.id));
        setForm(group ? { ...EMPTY, ...group, standardAgeGroupId: standard?.id || group.id } : EMPTY);
      })
      .catch((err) => setErrors({ _form: err.message || 'Không tải được danh mục nhóm tuổi chuẩn' }))
      .finally(() => setCatalogLoading(false));
    setErrors({});
  }, [open, group]);

  const used = group ? classes.filter((c) => c.ageGroupId === group.id) : [];
  const usedCampuses = new Set(used.map((c) => c.campusId)).size;

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => errorsAfterChange(e, patch, { ...form, ...patch }, AGE_GROUP_LIMITS));
  };
  const others = existing.filter((g) => g.id !== group?.id);
  const toggleMeal = (s) =>
    set({ mealSessions: form.mealSessions.includes(s) ? form.mealSessions.filter((x) => x !== s) : [...form.mealSessions, s] });
  // Đổi bữa của nhóm đang có lớp: cảnh báo áp dụng từ nay, dữ liệu cũ giữ nguyên
  const mealsChanged = !!group && [...(group.mealSessions || [])].sort().join(',') !== [...form.mealSessions].sort().join(',');
  // Màn hình biết lớp của năm đang chọn; mock/BE kiểm tra lại trên mọi năm chưa kết thúc
  const selectedStandard = catalog.find((item) => String(item.id) === String(form.standardAgeGroupId));
  const availableCatalog = catalog.filter(
    (item) => String(item.id) === String(group?.id) || !existing.some((current) => String(current.id) === String(item.id)),
  );
  const check = () => {
    const result = validateAgeGroup(form, others, { blockingClasses: used });
    if (!form.standardAgeGroupId) result.standardAgeGroupId = 'Chọn một nhóm tuổi chuẩn để áp dụng';
    if (selectedStandard && Number(form.maxClassSize) > Number(selectedStandard.maxClassSize))
      result.maxClassSize = `Sĩ số không vượt quá ${selectedStandard.maxClassSize} trẻ/lớp theo nhóm tuổi đã chọn`;
    return result;
  };
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
      await saveAgeGroup(group?.id || null, form, user, yearId);
      toast.success('Đã lưu thay đổi.', group ? 'Cập nhật nhóm tuổi' : 'Thêm nhóm tuổi');
      onClose(true);
    } catch (err) {
      setErrors(err.details || { _form: err.message });
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
      title={group ? `Sửa cấu hình ${group.shortName}` : 'Chọn nhóm tuổi áp dụng'}
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
      {errors._form && (
        <div className="alert alert--danger mb-12" role="alert">
          {errors._form}
        </div>
      )}
      <div className="grid-2">
        <FormField
          label="Nhóm tuổi chuẩn"
          required
          error={errors.standardAgeGroupId}
          hint="Trường chỉ chọn các nhóm thực tế mở trong năm học này."
        >
          <select
            className="select"
            value={form.standardAgeGroupId}
            disabled={!!group || catalogLoading}
            onChange={(event) => {
              const standard = catalog.find((item) => String(item.id) === event.target.value);
              if (!standard) return set({ standardAgeGroupId: '' });
              set({
                standardAgeGroupId: standard.id,
                name: standard.name,
                shortName: standard.shortName,
                ageFromMonths: standard.ageFromMonths,
                ageToMonths: standard.ageToMonths,
                maxClassSize: standard.maxClassSize,
              });
            }}
          >
            <option value="">Chọn nhóm tuổi</option>
            {availableCatalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · tối đa {item.maxClassSize} trẻ/lớp
              </option>
            ))}
          </select>
        </FormField>
        <div />
        <TextField label="Tên nhóm tuổi" required error={errors.name} value={form.name} disabled />
        <TextField label="Tên ngắn" required error={errors.shortName} value={form.shortName} disabled />
        <TextField label="Độ tuổi từ (tháng)" value={form.ageFromMonths} disabled />
        <TextField label="Độ tuổi đến (tháng)" value={form.ageToMonths} disabled />
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
        {numberField('maxClassSize', 'Sĩ số tối đa / lớp', {
          min: 1,
          max: selectedStandard?.maxClassSize,
          hint: selectedStandard ? `Không vượt quá ${selectedStandard.maxClassSize} trẻ/lớp` : undefined,
        })}
      </div>
      <FormField label="Yêu cầu dinh dưỡng" error={errors.nutritionNote} className="mt-12">
        <textarea className="textarea" rows={2} value={form.nutritionNote} onChange={(e) => set({ nutritionNote: e.target.value })} />
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
