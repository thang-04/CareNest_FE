import { useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Spinner } from '@/components/ui/States';
import { saveClassTeachers } from '@/services/school-config/schoolConfigService';
import { validateClassTeachers, hasErrors } from '@/utils/school-config/schoolConfigValidation';
import { ClassTeachersPicker, toggleTeacher } from '@/components/school-config/ClassTeachersPicker';

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

  const [confirmRemove, setConfirmRemove] = useState(false);

  const submit = () => {
    const e = validateClassTeachers(form);
    setErrors(e);
    if (hasErrors(e)) return;
    // Bỏ chọn hết giáo viên = gỡ toàn bộ giáo viên khỏi lớp: hỏi lại trước khi lưu
    if (form.teacherIds.length === 0 && cls.teacherIds.length > 0) setConfirmRemove(true);
    else save();
  };

  const save = async () => {
    setConfirmRemove(false);
    setSaving(true);
    try {
      await saveClassTeachers(cls.id, form, user);
      toast.success('Đã lưu. Hãy báo trực tiếp cho giáo viên được phân công.', cls.name);
      onClose(true);
    } catch (err) {
      setErrors(err.details || { _form: err.message });
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title={`${cls.addMore ? 'Phân công thêm giáo viên' : 'Phân công giáo viên'} – ${cls.name}`}
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
      {errors._form && (
        <div className="alert alert--danger mb-12" role="alert">
          {errors._form}
        </div>
      )}
      <ClassTeachersPicker
        teachers={teachers}
        classesOf={classesOf}
        classId={cls.id}
        form={form}
        onToggle={toggle}
        onHomeroom={(id) => setForm((f) => ({ ...f, homeroomTeacherId: id }))}
        errors={errors}
        // Phân công thêm: giữ giáo viên đang có, chỉ tích thêm
        lockedIds={cls.addMore ? cls.teacherIds : []}
      />
      <ConfirmationModal
        open={confirmRemove}
        danger
        title="Gỡ giáo viên"
        message={
          <>
            Gỡ toàn bộ giáo viên khỏi lớp <b>{cls.name}</b>? Giáo viên hết phụ trách lớp từ hôm nay; lịch sử phân công vẫn giữ.
          </>
        }
        confirmLabel="Gỡ giáo viên"
        onConfirm={save}
        onClose={() => setConfirmRemove(false)}
      />
    </Modal>
  );
}
