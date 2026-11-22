import { useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Spinner } from '@/components/ui/States';
import { saveClassTeachers } from '@/services/school-config/schoolConfigService';
import { validateClassTeachers, hasErrors, teachersFromOtherCampus } from '@/utils/school-config/schoolConfigValidation';
import { ClassTeachersPicker, toggleTeacher } from '@/components/school-config/ClassTeachersPicker';

/** Assign the teachers (and homeroom teacher) of one class. Used by Teacher Assignment and Age Groups & Classes. */
export function ClassTeachersModal({ cls, teachers, classesOf, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const { schoolYear, schoolYears } = useSchoolYear();
  // Lớp của năm đang học: 2–3 GV, có GV phụ trách chính (BE SCH-04) — báo ngay dưới ô trước khi lưu
  const yearId = cls.schoolYear ?? schoolYear;
  const yearActive = schoolYears.find((y) => String(y.id) === String(yearId))?.status === 'ACTIVE';
  const [form, setForm] = useState({ teacherIds: [...cls.teacherIds], homeroomTeacherId: cls.homeroomTeacherId || '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const toggle = (id) => {
    setErrors({});
    setForm((f) => toggleTeacher(f, id));
  };

  const [confirmRemove, setConfirmRemove] = useState(false);
  const [moving, setMoving] = useState([]);
  const campusName = (id) => md.campusById(String(id))?.shortName || md.campusById(String(id))?.name || 'cơ sở khác';

  const submit = () => {
    const e = validateClassTeachers(form, { yearActive });
    setErrors(e);
    if (hasErrors(e)) return;
    // Bỏ chọn hết giáo viên = gỡ toàn bộ giáo viên khỏi lớp: hỏi lại trước khi lưu
    if (form.teacherIds.length === 0 && cls.teacherIds.length > 0) return setConfirmRemove(true);
    const others = teachersFromOtherCampus(form.teacherIds, teachers, cls.campusId);
    if (others.length) setMoving(others);
    else save();
  };

  const save = async () => {
    setConfirmRemove(false);
    setMoving([]);
    setSaving(true);
    try {
      await saveClassTeachers(cls.id, form, user);
      toast.success('Đã lưu.', cls.name);
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
      <ConfirmationModal
        open={moving.length > 0}
        title="Xếp giáo viên của cơ sở khác"
        message={
          <>
            {moving.map((t) => `${t.fullName} (${campusName(t.campusId)})`).join(', ')} đang thuộc cơ sở khác. Lưu phân công thì cơ sở công
            tác của giáo viên chuyển sang <b>{campusName(cls.campusId)}</b>.
          </>
        }
        confirmLabel="Xếp và chuyển cơ sở"
        onConfirm={save}
        onClose={() => setMoving([])}
      />
    </Modal>
  );
}
