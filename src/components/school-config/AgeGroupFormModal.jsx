import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { saveAgeGroup } from '@/services/school-config/schoolConfigService';
import { validateAgeGroup, hasErrors } from '@/utils/school-config/schoolConfigValidation';

const EMPTY = { name: '', shortName: '', ageRange: '', mealsPerDay: 2, nutritionNote: '' };

/** Age group information (Age Group entity: name, age range, meals per day, nutrition requirement). */
export function AgeGroupFormModal({ open, onClose, group, existing }) {
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

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };
  const others = existing.filter((g) => g.id !== group?.id);
  const blurCheck = (field) => {
    const e = validateAgeGroup(form, others);
    if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };

  const submit = async () => {
    const e = validateAgeGroup(form, others);
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      await saveAgeGroup(group?.id || null, form, user);
      toast.success('Đã lưu thay đổi.', group ? 'Cập nhật nhóm tuổi' : 'Thêm nhóm tuổi');
      onClose(true);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được thay đổi');
    } finally {
      setSaving(false);
    }
  };

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
            maxLength={80}
            onChange={(e) => set({ name: e.target.value })}
            onBlur={() => blurCheck('name')}
          />
        </FormField>
        <FormField label="Tên ngắn" required error={errors.shortName} hint="Hiển thị trong bảng, ví dụ Mẫu giáo bé">
          <input className="input" value={form.shortName} maxLength={40} onChange={(e) => set({ shortName: e.target.value })} />
        </FormField>
        <FormField label="Độ tuổi" required error={errors.ageRange}>
          <input className="input" value={form.ageRange} placeholder="3–4 tuổi" onChange={(e) => set({ ageRange: e.target.value })} />
        </FormField>
        <FormField label="Số bữa mỗi ngày" required error={errors.mealsPerDay} hint="Nhà trẻ 3 bữa, mẫu giáo 2 bữa">
          <input
            className="input"
            type="number"
            min={1}
            max={5}
            value={form.mealsPerDay}
            onChange={(e) => set({ mealsPerDay: e.target.value })}
            onBlur={() => blurCheck('mealsPerDay')}
          />
        </FormField>
      </div>
      <FormField label="Yêu cầu dinh dưỡng" className="mt-12">
        <textarea
          className="textarea"
          rows={3}
          maxLength={500}
          value={form.nutritionNote}
          onChange={(e) => set({ nutritionNote: e.target.value })}
        />
      </FormField>
    </Modal>
  );
}
