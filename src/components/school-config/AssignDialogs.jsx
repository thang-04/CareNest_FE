import { useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { useTeacherAssignments } from '@/hooks/school-config/useSchoolConfig';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { ClassTeachersModal } from '@/components/school-config/ClassTeachersModal';
import { saveTeamLeader } from '@/services/school-config/schoolConfigService';

/** Class teachers from the Age Groups & Classes screen: loads the teachers of the class campus, then reuses ClassTeachersModal. */
export function AssignClassTeachersDialog({ cls, schoolYear, onClose }) {
  const { data, loading, error } = useTeacherAssignments(schoolYear, cls.campusId);
  if (loading || error)
    return (
      <Modal open title={`Phân công giáo viên – ${cls.name}`} onClose={() => onClose(false)}>
        {error ? <ErrorState error={error} /> : <LoadingState />}
      </Modal>
    );
  const classes = data?.classes || [];
  const current = classes.find((c) => c.id === cls.id) || cls;
  return (
    <ClassTeachersModal
      cls={current}
      teachers={data?.teachers || []}
      classesOf={(teacherId) => classes.filter((c) => c.teacherIds.includes(teacherId))}
      onClose={onClose}
    />
  );
}

/** Team leader of one age group at one campus (one leader per age group and campus; a teacher leads one group per year). */
export function AssignTeamLeaderDialog({ group, campusIds, schoolYear, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const [campusId, setCampusId] = useState(campusIds[0]);
  const { data, loading, error } = useTeacherAssignments(schoolYear, campusId);
  const current = (data?.teamLeaders || []).find((a) => a.ageGroupId === group.id)?.userId || '';
  const [picked, setPicked] = useState(null);
  const value = picked ?? current;
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await saveTeamLeader({ schoolYear, campusId, ageGroupId: group.id, userId: value || null }, user);
      toast.success(value ? 'Đã lưu thay đổi. Tổ trưởng đã nhận thông báo.' : 'Đã bỏ phân công tổ trưởng.', group.name);
      onClose(true);
    } catch (err) {
      toast.error(err.message, 'Không lưu được thay đổi');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={`Tổ trưởng ${group.shortName}`}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={save} disabled={saving || loading || value === current}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu tổ trưởng
          </button>
        </>
      }
    >
      {campusIds.length > 1 && (
        <FormField label="Điểm trường">
          <select
            className="select"
            value={campusId}
            onChange={(e) => {
              setCampusId(e.target.value);
              setPicked(null);
            }}
          >
            {campusIds.map((id) => (
              <option key={id} value={id}>
                {md.campusById(id)?.shortName || id}
              </option>
            ))}
          </select>
        </FormField>
      )}
      {error ? (
        <ErrorState error={error} />
      ) : loading ? (
        <LoadingState />
      ) : (
        <FormField
          label="Tổ trưởng"
          hint="Giáo viên của điểm trường; mỗi giáo viên làm tổ trưởng tối đa một nhóm tuổi trong năm học"
          className="mt-12"
        >
          <select className="select" value={value} onChange={(e) => setPicked(e.target.value)}>
            <option value="">Chưa phân công</option>
            {(data?.teachers || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </select>
        </FormField>
      )}
    </Modal>
  );
}
