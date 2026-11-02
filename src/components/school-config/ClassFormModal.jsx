import { useEffect, useRef, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { saveClass } from '@/services/school-config/schoolConfigService';
import { classSizeLimit, validateClass, hasErrors, errorsAfterChange, CLASS_LIMITS } from '@/utils/school-config/schoolConfigValidation';
import { isActiveLocation, LOCATION_TYPES } from '@/models/Location';

const empty = (schoolYear, campusId, ageGroup) => ({
  name: '',
  campusId: campusId || '',
  ageGroupId: ageGroup?.id || '',
  schoolYear,
  capacity: ageGroup?.maxClassSize || '',
  locationId: '',
});

/**
 * Class Form (SRS 4.1.5, UC 2.2 step 5). Teachers are assigned by the Vice Principal on Teacher Assignment, only shown here.
 * Saving a class never enrolls or moves a child.
 */
export function ClassFormModal({ open, onClose, cls, schoolYear, yearName, defaults, campuses, ageGroups, locations, existing }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => empty(schoolYear));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Chỉ nạp form khi mở dialog: dữ liệu màn hình tải lại (refreshOnDataChange) không được xóa nội dung đang nhập
  const ageGroupsRef = useRef(ageGroups);
  ageGroupsRef.current = ageGroups;
  useEffect(() => {
    if (!open) return;
    const group = ageGroupsRef.current.find((g) => g.id === defaults?.ageGroupId);
    setForm(cls ? { ...cls, locationId: cls.locationId || '' } : empty(schoolYear, defaults?.campusId, group));
    setErrors({});
  }, [open, cls, schoolYear, defaults]);

  const enrolled = cls?.childCount || 0;
  const locked = enrolled > 0;
  const ageGroup = ageGroups.find((g) => g.id === form.ageGroupId) || null;
  const room = locations.find((l) => l.id === form.locationId) || null;
  // Sĩ số tối đa của lớp: từ số trẻ đang học đến min(sĩ số tối đa của nhóm tuổi, sức chứa phòng)
  const limit = classSizeLimit(ageGroup, room);
  const maxCapacity = limit.reason ? limit.max : undefined;
  const check = () =>
    validateClass(
      form,
      existing.filter((c) => c.id !== cls?.id),
      { ageGroup, room, enrolled },
    );

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => errorsAfterChange(e, patch, { ...form, ...patch }, CLASS_LIMITS));
  };
  const blurCheck = (field) => {
    const e = check();
    if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };

  // Tạo mới: sĩ số mặc định = mức tối đa cho phép (min nhóm tuổi, sức chứa phòng)
  const changeAgeGroup = (id) => {
    const group = ageGroups.find((g) => g.id === id);
    set(cls || !group ? { ageGroupId: id } : { ageGroupId: id, capacity: classSizeLimit(group, room).max });
  };
  const changeRoom = (id) => {
    const next = locations.find((l) => l.id === id);
    const cap = classSizeLimit(ageGroup, next).max;
    if (cls) {
      const over = Number(form.capacity) > cap;
      return set(over ? { locationId: id, capacity: Math.max(cap, enrolled) } : { locationId: id });
    }
    return set(cap < Number.MAX_SAFE_INTEGER ? { locationId: id, capacity: cap } : { locationId: id });
  };

  // Phòng chọn được: phòng học đang sử dụng của điểm trường; phòng đã có lớp khác cùng năm hiện nhưng khóa; luôn giữ phòng hiện tại
  const takenBy = Object.fromEntries(existing.filter((c) => c.id !== cls?.id && c.locationId).map((c) => [c.locationId, c.name]));
  const rooms = locations.filter(
    (l) => l.campusId === form.campusId && l.type === LOCATION_TYPES.CLASS && (isActiveLocation(l) || l.id === cls?.locationId),
  );

  const submit = async () => {
    const e = check();
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      await saveClass(cls?.id || null, { ...form, capacity: Number(form.capacity) }, user);
      toast.success('Đã lưu thay đổi.', cls ? 'Cập nhật lớp' : 'Tạo lớp');
      onClose(true);
    } catch (err) {
      setErrors(err.details || { _form: err.message });
    } finally {
      setSaving(false);
    }
  };

  const from = `Từ ${Math.max(1, enrolled)}${enrolled ? ' (số trẻ đang học)' : ''}`;
  const capacityHint = limit.reason ? `${from} đến ${limit.max} (${limit.reason})` : undefined;

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
            {saving ? <Spinner small /> : <Save size={16} />} Lưu lớp
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
        <FormField label="Tên lớp" required error={errors.name}>
          <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} onBlur={() => blurCheck('name')} />
        </FormField>
        <FormField label="Năm học">
          <input className="input" value={yearName || schoolYear} disabled />
        </FormField>
        <FormField
          label="Nhóm tuổi"
          required
          error={errors.ageGroupId}
          hint={locked ? 'Lớp đã có trẻ nên không đổi được nhóm tuổi' : undefined}
        >
          <select className="select" value={form.ageGroupId} disabled={locked} onChange={(e) => changeAgeGroup(e.target.value)}>
            <option value="">Chọn nhóm tuổi</option>
            {ageGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Điểm trường"
          required
          error={errors.campusId}
          hint={locked ? 'Lớp đã có trẻ nên không đổi được điểm trường' : undefined}
        >
          <select
            className="select"
            value={form.campusId}
            disabled={locked}
            onChange={(e) => set({ campusId: e.target.value, locationId: '' })}
          >
            <option value="">Chọn điểm trường</option>
            {campuses
              .filter((c) => c.status !== 'INACTIVE' || c.id === form.campusId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName || c.name}
                </option>
              ))}
          </select>
        </FormField>
        <FormField
          label="Phòng học"
          required
          error={errors.locationId}
          hint={form.campusId && !rooms.length ? 'Điểm trường chưa có phòng học (thêm ở màn Phòng học)' : undefined}
        >
          <select
            className="select"
            value={form.locationId}
            onChange={(e) => changeRoom(e.target.value)}
            onBlur={() => blurCheck('locationId')}
            disabled={!form.campusId}
          >
            <option value="">{form.campusId ? 'Chọn phòng học' : 'Chọn điểm trường trước'}</option>
            {rooms.map((l) => (
              <option key={l.id} value={l.id} disabled={!!takenBy[l.id]}>
                {l.room ? `${l.room} – ${l.name}` : l.name}
                {l.capacity ? ` · sức chứa ${l.capacity}` : ''}
                {takenBy[l.id] ? ` (đang dùng: ${takenBy[l.id]})` : ''}
                {isActiveLocation(l) ? '' : ' (ngừng sử dụng)'}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Sĩ số tối đa" required error={errors.capacity} hint={capacityHint}>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={Math.max(1, enrolled)}
            max={maxCapacity}
            value={form.capacity}
            onChange={(e) => set({ capacity: e.target.value })}
            onBlur={() => blurCheck('capacity')}
          />
        </FormField>
      </div>
    </Modal>
  );
}
