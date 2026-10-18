import { useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { saveClassTeachers } from '@/services/school-config/schoolConfigService';
import { validateClassTeachers, hasErrors } from '@/utils/school-config/schoolConfigValidation';
import { ClassTeachersPicker, teachersHint, toggleTeacher } from '@/components/school-config/ClassTeachersPicker';

/** Assign the teachers (and homeroom teacher) of one class. Used by Teacher Assignment and Age Groups & Classes. */
export function ClassTeachersModal({ cls, teachers, classesOf, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ teacherIds: [...cls.teacherIds], homeroomTeacherId: cls.homeroomTeacherId || '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const toggle = (id) => {
    setErrors({});
    setForm((f) => toggleTeacher(f, id));
  };

  const valid = !hasErrors(validateClassTeachers(form));
  const hint = teachersHint(form);

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
          <button className="btn btn--primary" onClick={submit} disabled={saving || !valid}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu phân công
          </button>
        </>
      }
    >
      <ClassTeachersPicker
        teachers={teachers}
        classesOf={classesOf}
        classId={cls.id}
        form={form}
        onToggle={toggle}
        onHomeroom={(id) => setForm((f) => ({ ...f, homeroomTeacherId: id }))}
        errors={errors}
        hint={hint}
      />
    </Modal>
  );
}
