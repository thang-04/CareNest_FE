import { useState } from 'react';
import { UserMinus } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { ClassTeachersPicker } from '@/components/school-config/ClassTeachersPicker';
import { saveClassTeachers } from '@/services/school-config/schoolConfigService';
import { validateClassTeachers } from '@/utils/school-config/schoolConfigValidation';

/**
 * Gỡ giáo viên khỏi lớp, có thể chọn luôn giáo viên thay thế và chủ nhiệm trong cùng một lần lưu (Cần chốt 22/10/2026):
 * - không thêm ai, gỡ chủ nhiệm mà lớp còn 1 cô ⇒ cô còn lại làm chủ nhiệm;
 * - có thêm người thay thế ⇒ phải tích chủ nhiệm trong các giáo viên sau khi đổi;
 * - năm học đang hoạt động không để lớp trống: gỡ hết thì bắt buộc chọn người thay thế; năm sắp tới được gỡ hết.
 * teachers: giáo viên của điểm trường lớp; classesOf(id): lớp giáo viên đang dạy (khóa người đang dạy lớp khác).
 */
export function RemoveTeachersModal({ cls, nameOf, yearActive, teachers, classesOf, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [picked, setPicked] = useState([]);
  const [added, setAdded] = useState([]);
  const [homeroomChoice, setHomeroomChoice] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const remaining = cls.teacherIds.filter((id) => !picked.includes(id));
  const result = [...remaining, ...added];
  const removingAll = picked.length > 0 && remaining.length === 0;
  // Chủ nhiệm sau khi gỡ: người dùng tích > chủ nhiệm cũ còn ở lại > cô duy nhất còn lại (khi không thêm ai)
  const keptHomeroom = remaining.includes(cls.homeroomTeacherId) ? cls.homeroomTeacherId : '';
  const autoHomeroom = keptHomeroom || (!added.length && remaining.length === 1 ? remaining[0] : '');
  const homeroom = result.includes(homeroomChoice) ? homeroomChoice : autoHomeroom;

  const togglePicked = (id) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    setErrors({});
  };
  const toggleAdded = (id) => {
    if (remaining.includes(id)) return;
    setAdded((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));
    setErrors({});
  };

  const submit = async () => {
    if (!picked.length) return setErrors({ _form: 'Tích giáo viên cần gỡ khỏi lớp' });
    if (removingAll && yearActive && !added.length) return setErrors({ teacherIds: 'Năm học đang hoạt động: chọn giáo viên thay thế' });
    const form = { teacherIds: result, homeroomTeacherId: homeroom };
    // Có người thay thế ⇒ bắt buộc chủ nhiệm như hộp phân công
    const e = validateClassTeachers(form, { requireHomeroom: added.length > 0 });
    if (e.teacherIds || e.homeroomTeacherId) return setErrors(e);
    setSaving(true);
    try {
      await saveClassTeachers(cls.id, form, user);
      toast.success(`Đã gỡ ${picked.map(nameOf).join(', ')} khỏi lớp.`, cls.name);
      onClose(true);
    } catch (err) {
      setErrors(err.details || { _form: err.message });
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size={picked.length ? 'lg' : undefined}
      title={`Gỡ giáo viên – ${cls.name}`}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--danger" onClick={submit} disabled={saving}>
            {saving ? <Spinner small /> : <UserMinus size={16} />} Gỡ {picked.length || ''} giáo viên
          </button>
        </>
      }
    >
      {errors._form && (
        <div className="alert alert--danger mb-12" role="alert">
          {errors._form}
        </div>
      )}
      <FormField label="Giáo viên cần gỡ" required>
        <div className="stack">
          {cls.teacherIds.map((id) => (
            <label key={id} className="checkbox">
              <input type="checkbox" checked={picked.includes(id)} onChange={() => togglePicked(id)} /> {nameOf(id)}
              {id === cls.homeroomTeacherId && <span className="muted text-sm"> (chủ nhiệm)</span>}
            </label>
          ))}
        </div>
      </FormField>
      {removingAll && !yearActive && !added.length && (
        <div className="alert alert--warning mt-12">
          Gỡ toàn bộ giáo viên khỏi lớp {cls.name}? Giáo viên hết phụ trách lớp từ hôm nay; lịch sử phân công vẫn giữ.
        </div>
      )}
      {picked.length > 0 && (
        <FormField label="Giáo viên thay thế và chủ nhiệm" required={removingAll && yearActive} className="mt-12">
          <ClassTeachersPicker
            teachers={teachers.filter((t) => !picked.includes(t.id))}
            classesOf={classesOf}
            classId={cls.id}
            form={{ teacherIds: result, homeroomTeacherId: homeroom }}
            lockedIds={remaining}
            onToggle={toggleAdded}
            onHomeroom={(id) => {
              setHomeroomChoice(id);
              setErrors({});
            }}
            errors={errors}
          />
        </FormField>
      )}
    </Modal>
  );
}
