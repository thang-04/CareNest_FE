import { useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { DateInput } from '@/components/form/DateInput';
import { assignSubstituteTeacher } from '@/services/school-config/schoolConfigService';
import { formatDate, isIsoDate, todayInput } from '@/utils/format';

/**
 * Dạy thay (BE AUTH-16, AUTH-24, SCH-04): GV khác dạy thay một GV đứng lớp trong khoảng ngày (vd. cô nghỉ ốm, nghỉ sinh);
 * không đổi phân công chính của lớp. BE kiểm năm học, tài khoản, điểm trường, người được thay và ngày kết thúc.
 */
export function SubstituteTeacherModal({ cls, teachers, yearEnd, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const today = todayInput();
  const [form, setForm] = useState({ userId: '', replacedTeacherId: '', validFrom: today, validTo: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const candidates = teachers.filter((t) => !cls.teacherIds.includes(t.id));
  // Người được thay: GV đang đứng lớp
  const classTeachers = teachers.filter((t) => cls.teacherIds.includes(t.id));
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors({});
  };

  const save = async () => {
    const e = {};
    if (!form.replacedTeacherId) e.replacedTeacherId = 'Chọn giáo viên được dạy thay';
    if (!form.userId) e.userId = 'Chọn giáo viên dạy thay';
    if (!isIsoDate(form.validFrom)) e.validFrom = 'Chọn ngày bắt đầu';
    else if (form.validFrom < today) e.validFrom = 'Không chọn ngày đã qua';
    if (!isIsoDate(form.validTo)) e.validTo = 'Chọn ngày kết thúc';
    else if (isIsoDate(form.validFrom) && form.validTo < form.validFrom) e.validTo = 'Ngày kết thúc phải từ ngày bắt đầu';
    else if (yearEnd && form.validTo > yearEnd) e.validTo = `Không quá ngày kết thúc năm học (${formatDate(yearEnd)})`;
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await assignSubstituteTeacher({ ...form, classroomId: cls.id }, user);
      const name = candidates.find((t) => String(t.id) === String(form.userId))?.fullName || '';
      const replaced = classTeachers.find((t) => String(t.id) === String(form.replacedTeacherId))?.fullName || '';
      toast.success(`${name} dạy thay ${replaced} lớp ${cls.name} từ ${formatDate(form.validFrom)} đến ${formatDate(form.validTo)}.`);
      onClose(true);
    } catch (err) {
      setErrors(err.details || { _form: err.message });
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={`Dạy thay – ${cls.name}`}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu dạy thay
          </button>
        </>
      }
    >
      <p className="text-sm text-2 mb-12">
        Giáo viên dạy thay được điểm danh, đánh giá lớp trong khoảng ngày này; giáo viên chính của lớp không đổi.
      </p>
      {errors._form && (
        <div className="alert alert--danger mb-12" role="alert">
          {errors._form}
        </div>
      )}
      <FormField label="Dạy thay cho" required error={errors.replacedTeacherId}>
        <select className="select" value={form.replacedTeacherId} onChange={(e) => set({ replacedTeacherId: e.target.value })}>
          <option value="">Chọn giáo viên đứng lớp</option>
          {classTeachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Giáo viên dạy thay" required error={errors.userId}>
        <select className="select" value={form.userId} onChange={(e) => set({ userId: e.target.value })}>
          <option value="">Chọn giáo viên</option>
          {candidates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
      </FormField>
      <div className="row gap-3">
        <FormField label="Từ ngày" required error={errors.validFrom}>
          <DateInput min={today} max={yearEnd} value={form.validFrom} onChange={(v) => set({ validFrom: v })} />
        </FormField>
        <FormField label="Đến ngày" required error={errors.validTo}>
          <DateInput min={form.validFrom || today} max={yearEnd} value={form.validTo} onChange={(v) => set({ validTo: v })} />
        </FormField>
      </div>
    </Modal>
  );
}
