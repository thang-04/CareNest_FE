import { useEffect, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { saveClass } from '@/services/school-config/schoolConfigService';
import { validateClass, hasErrors } from '@/utils/school-config/schoolConfigValidation';

const empty = (schoolYear, campusId, ageGroupId) => ({
  name: '',
  campusId: campusId || '',
  ageGroupId: ageGroupId || '',
  schoolYear,
  capacity: 25,
  locationId: '',
});

/** Create / edit one class (UC 2.2 step 5). Teachers are assigned by the Vice Principal (#26), not here. */
export function ClassFormModal({ open, onClose, cls, schoolYear, defaults, campuses, ageGroups, locations, existing }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => empty(schoolYear));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(cls ? { ...cls, locationId: cls.locationId || '' } : empty(schoolYear, defaults?.campusId, defaults?.ageGroupId));
    setErrors({});
  }, [open, cls, schoolYear, defaults]);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const blurCheck = (field) => {
    const e = validateClass(
      form,
      existing.filter((c) => c.id !== cls?.id),
    );
    if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };

  const rooms = locations.filter((l) => l.campusId === form.campusId && l.type === 'CLASS');

  const submit = async () => {
    const e = validateClass(
      form,
      existing.filter((c) => c.id !== cls?.id),
    );
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      await saveClass(cls?.id || null, { ...form, capacity: Number(form.capacity) }, user);
      toast.success('Đã lưu thay đổi.', cls ? 'Cập nhật lớp' : 'Tạo lớp');
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
      title={cls ? `Sửa lớp ${cls.name}` : 'Thêm lớp'}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={saving}>
            {saving ? <Spinner small /> : <Save size={16} />} {cls ? 'Lưu lớp' : 'Tạo lớp'}
          </button>
        </>
      }
    >
      <div className="grid-2">
        <FormField label="Tên lớp" required error={errors.name}>
          <input
            className="input"
            value={form.name}
            maxLength={60}
            onChange={(e) => set({ name: e.target.value })}
            onBlur={() => blurCheck('name')}
          />
        </FormField>
        <FormField label="Năm học" hint="Lớp tồn tại trong năm học này và đóng cùng năm học">
          <input className="input" value={schoolYear} disabled />
        </FormField>
        <FormField label="Điểm trường" required error={errors.campusId}>
          <select className="select" value={form.campusId} onChange={(e) => set({ campusId: e.target.value, locationId: '' })}>
            <option value="">Chọn điểm trường</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName || c.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Nhóm tuổi" required error={errors.ageGroupId}>
          <select className="select" value={form.ageGroupId} onChange={(e) => set({ ageGroupId: e.target.value })}>
            <option value="">Chọn nhóm tuổi</option>
            {ageGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Phòng học" hint={form.campusId && !rooms.length ? 'Điểm trường chưa có phòng học' : undefined}>
          <select
            className="select"
            value={form.locationId}
            onChange={(e) => set({ locationId: e.target.value })}
            disabled={!form.campusId}
          >
            <option value="">Chưa xếp phòng</option>
            {rooms.map((l) => (
              <option key={l.id} value={l.id}>
                {l.room ? `${l.room} – ${l.name}` : l.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Sĩ số tối đa" required error={errors.capacity}>
          <input
            className="input"
            type="number"
            min={1}
            max={60}
            value={form.capacity}
            onChange={(e) => set({ capacity: e.target.value })}
            onBlur={() => blurCheck('capacity')}
          />
        </FormField>
      </div>
    </Modal>
  );
}
