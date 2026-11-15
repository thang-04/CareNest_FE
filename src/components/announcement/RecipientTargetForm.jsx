import { useEffect, useState } from 'react';
import { announcements } from '@/services/announcement/announcementService';
import { useAuth } from '@/contexts/AuthContext';

const roles = [
  ['PARENT', 'Phụ huynh'],
  ['TEACHER', 'Giáo viên'],
  ['KITCHEN', 'Nhân viên bếp'],
  ['BGH', 'Ban giám hiệu'],
];
export const emptyTarget = { scopeType: 'SCHOOL', campusId: null, ageGroupId: null, classroomId: null, roles: [] };

export default function RecipientTargetForm({ value, onChange }) {
  const { user } = useAuth();
  const vicePrincipal = user?.role === 'VICE_PRINCIPAL';
  const [catalog, setCatalog] = useState({ campuses: [], ageGroups: [], classes: [] });
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([announcements.campuses(), announcements.ageGroups(), announcements.schoolStructure()])
      .then(([campuses, ageGroups, structure]) => {
        if (active) setCatalog({ campuses, ageGroups, classes: structure.classes || [] });
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const change = (key, raw) => onChange({ ...value, [key]: raw ? Number(raw) : null });
  return (
    <fieldset className="stack gap-2">
      <legend>Người nhận</legend>
      {error && <p role="alert">Không tải được danh mục: {error}</p>}
      <label className="field">
        Phạm vi{' '}
        <select
          className="select"
          value={value.scopeType}
          onChange={(e) => onChange({ ...value, scopeType: e.target.value, campusId: null, ageGroupId: null, classroomId: null })}
        >
          <option value="SCHOOL" disabled={vicePrincipal}>
            Toàn trường
          </option>
          <option value="CAMPUS">Điểm trường</option>
          <option value="AGE_GROUP">Nhóm tuổi</option>
          <option value="CLASSROOM">Lớp</option>
        </select>
      </label>
      {['CAMPUS', 'AGE_GROUP'].includes(value.scopeType) && (
        <label className="field">
          Điểm trường{' '}
          <select
            className="select"
            required={value.scopeType === 'CAMPUS' || vicePrincipal}
            value={value.campusId ?? ''}
            onChange={(e) => change('campusId', e.target.value)}
          >
            <option value="">Chọn điểm trường</option>
            {catalog.campuses.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {value.scopeType === 'AGE_GROUP' && (
        <label className="field">
          Nhóm tuổi{' '}
          <select className="select" required value={value.ageGroupId ?? ''} onChange={(e) => change('ageGroupId', e.target.value)}>
            <option value="">Chọn nhóm tuổi</option>
            {catalog.ageGroups.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {value.scopeType === 'CLASSROOM' && (
        <label className="field">
          Lớp{' '}
          <select className="select" required value={value.classroomId ?? ''} onChange={(e) => change('classroomId', e.target.value)}>
            <option value="">Chọn lớp</option>
            {catalog.classes.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div>
        {roles.map(([id, label]) => (
          <label key={id}>
            <input
              type="checkbox"
              checked={value.roles.includes(id)}
              onChange={(e) => onChange({ ...value, roles: e.target.checked ? [...value.roles, id] : value.roles.filter((r) => r !== id) })}
            />{' '}
            {label}{' '}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
