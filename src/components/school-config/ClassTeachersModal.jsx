import { useState } from 'react';
import { Users, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, Spinner } from '@/components/ui/States';
import { saveClassTeachers } from '@/services/school-config/schoolConfigService';
import { validateClassTeachers, hasErrors } from '@/utils/school-config/schoolConfigValidation';

/** Assign the teachers (and homeroom teacher) of one class. Used by Teacher Assignment and Age Groups & Classes. */
export function ClassTeachersModal({ cls, teachers, classesOf, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ teacherIds: [...cls.teacherIds], homeroomTeacherId: cls.homeroomTeacherId || '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const toggle = (id) => {
    setErrors({});
    setForm((f) => {
      const teacherIds = f.teacherIds.includes(id) ? f.teacherIds.filter((x) => x !== id) : [...f.teacherIds, id];
      // The homeroom teacher must stay one of the class teachers.
      const homeroomTeacherId = teacherIds.includes(f.homeroomTeacherId) ? f.homeroomTeacherId : teacherIds[0] || '';
      return { teacherIds, homeroomTeacherId };
    });
  };

  const submit = async () => {
    const e = validateClassTeachers(form);
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      await saveClassTeachers(cls.id, form, user);
      toast.success('Đã lưu thay đổi. Giáo viên mới được phân công đã nhận thông báo.', cls.name);
      onClose(true);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được thay đổi');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title={`Phân công giáo viên – ${cls.name}`}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={saving}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu phân công
          </button>
        </>
      }
    >
      {teachers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Điểm trường chưa có giáo viên"
          description="Cần có tài khoản giáo viên thuộc điểm trường để phân công."
        />
      ) : (
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Phụ trách lớp</th>
                <th>Giáo viên</th>
                <th>Lớp khác đang phụ trách</th>
                <th className="center">Chủ nhiệm</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => {
                const checked = form.teacherIds.includes(t.id);
                const others = classesOf(t.id).filter((c) => c.id !== cls.id);
                return (
                  <tr key={t.id} className={checked ? 'row--selected' : ''}>
                    <td>
                      <label className="checkbox">
                        <input type="checkbox" checked={checked} onChange={() => toggle(t.id)} aria-label={`Phân công ${t.fullName}`} />
                      </label>
                    </td>
                    <td className="fw-600">{t.fullName}</td>
                    <td className="text-sm">{others.length ? others.map((c) => c.name).join(', ') : <span className="muted">—</span>}</td>
                    <td className="center">
                      <input
                        type="radio"
                        name="sc-homeroom"
                        checked={form.homeroomTeacherId === t.id}
                        disabled={!checked}
                        onChange={() => setForm((f) => ({ ...f, homeroomTeacherId: t.id }))}
                        aria-label={`Chọn ${t.fullName} làm chủ nhiệm`}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(errors.homeroomTeacherId || errors.teacherIds) && (
        <span className="field__error mt-8" role="alert">
          {errors.homeroomTeacherId || errors.teacherIds}
        </span>
      )}
    </Modal>
  );
}
