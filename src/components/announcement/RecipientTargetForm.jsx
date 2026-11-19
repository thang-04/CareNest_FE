import { Checkbox, SelectField } from '@/components';
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

export default function RecipientTargetForm({ value, onChange, hideLegend = false, disabled = false }) {
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
    <fieldset className="announcement-fieldset" disabled={disabled}>
      <legend className={hideLegend ? 'sr-only' : undefined}>Người nhận</legend>
      {error && (
        <div className="alert alert--danger" role="alert">
          Không tải được danh mục: {error}
        </div>
      )}
      <div className="announcement-fields">
        <SelectField
          label="Phạm vi"
          value={value.scopeType}
          onChange={(e) => onChange({ ...value, scopeType: e.target.value, campusId: null, ageGroupId: null, classroomId: null })}
        >
          <option value="SCHOOL" disabled={vicePrincipal}>
            Toàn trường
          </option>
          <option value="CAMPUS">Điểm trường</option>
          <option value="AGE_GROUP">Nhóm tuổi</option>
          <option value="CLASSROOM">Lớp</option>
        </SelectField>
        {['CAMPUS', 'AGE_GROUP'].includes(value.scopeType) && (
          <SelectField
            label="Điểm trường"
            required={value.scopeType === 'CAMPUS' || vicePrincipal}
            value={value.campusId ?? ''}
            onChange={(e) => change('campusId', e.target.value)}
          >
            <option value="">Chọn điểm trường</option>
            {catalog.campuses.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </SelectField>
        )}
        {value.scopeType === 'AGE_GROUP' && (
          <SelectField label="Nhóm tuổi" required value={value.ageGroupId ?? ''} onChange={(e) => change('ageGroupId', e.target.value)}>
            <option value="">Chọn nhóm tuổi</option>
            {catalog.ageGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </SelectField>
        )}
        {value.scopeType === 'CLASSROOM' && (
          <SelectField label="Lớp" required value={value.classroomId ?? ''} onChange={(e) => change('classroomId', e.target.value)}>
            <option value="">Chọn lớp</option>
            {catalog.classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
              </option>
            ))}
          </SelectField>
        )}
      </div>
      <div className="announcement-roles">
        {roles.map(([id, label]) => (
          <label key={id} className="announcement-check">
            <Checkbox
              checked={value.roles.includes(id)}
              onChange={(e) =>
                onChange({ ...value, roles: e.target.checked ? [...value.roles, id] : value.roles.filter((role) => role !== id) })
              }
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
