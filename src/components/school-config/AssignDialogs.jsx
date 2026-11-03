import { useAuth } from '@/contexts/AuthContext';
import { useTeacherAssignments } from '@/hooks/school-config/useSchoolConfig';
import { isPrincipal } from '@/utils/school-config/schoolConfigPermissions';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { ClassTeachersModal } from '@/components/school-config/ClassTeachersModal';

/** Class teachers from the Age Groups & Classes screen: loads the teachers of the class campus, then reuses ClassTeachersModal. */
export function AssignClassTeachersDialog({ cls, schoolYear, onClose }) {
  const { user } = useAuth();
  // HT chọn GV mọi điểm trường (AUTH-16); PHT chỉ GV điểm trường của lớp
  const { data, loading, error } = useTeacherAssignments(schoolYear, isPrincipal(user) ? 'all' : cls.campusId);
  if (loading || error)
    return (
      <Modal open title={`Phân công giáo viên – ${cls.name}`} onClose={() => onClose(false)}>
        {error ? <ErrorState error={error} /> : <LoadingState />}
      </Modal>
    );
  const classes = data?.classes || [];
  // Lớp vừa tạo có thể chưa kèm danh sách giáo viên ⇒ mặc định rỗng
  const current = classes.find((c) => String(c.id) === String(cls.id)) || { teacherIds: [], homeroomTeacherId: '', ...cls };
  return (
    <ClassTeachersModal
      cls={current}
      teachers={data?.teachers || []}
      classesOf={(teacherId) => classes.filter((c) => c.teacherIds.includes(teacherId))}
      onClose={onClose}
    />
  );
}
