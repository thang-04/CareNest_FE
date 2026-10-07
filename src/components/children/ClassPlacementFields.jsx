import { Info } from 'lucide-react';
import { AGE_GROUPS, ageGroupById } from '@/models/School';

/**
 * Age group + class choice (SRS #29). Capacity numbers come from the service; the service re-checks them on save.
 * classes: [{ id, name, ageGroupId, capacity, enrolledCount, homeroomTeacherId }]
 */
export function ClassPlacementFields({
  classes,
  ageGroupId,
  onAgeGroupChange,
  classId,
  onClassChange,
  suggestedAgeGroupId,
  currentClassId,
  error,
  userById,
}) {
  const inGroup = classes.filter((c) => !ageGroupId || c.ageGroupId === ageGroupId);
  const mismatch = suggestedAgeGroupId && ageGroupId && suggestedAgeGroupId !== ageGroupId;

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="field" style={{ maxWidth: 360 }}>
        <label className="field__label" htmlFor="tr-age-group">
          Nhóm tuổi<span className="req">*</span>
        </label>
        <select id="tr-age-group" className="select" value={ageGroupId} onChange={(e) => onAgeGroupChange(e.target.value)}>
          <option value="">Tất cả nhóm tuổi</option>
          {AGE_GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
              {g.id === suggestedAgeGroupId ? ' – phù hợp độ tuổi' : ''}
            </option>
          ))}
        </select>
      </div>
      {mismatch && (
        <div className="alert alert--warning">
          <Info size={18} />
          <div>
            Theo ngày sinh, trẻ thường học nhóm <b>{ageGroupById(suggestedAgeGroupId)?.shortName}</b>. Kiểm tra lại trước khi xếp lớp.
          </div>
        </div>
      )}
      <fieldset className="tr-fieldset">
        <legend className="field__label">
          Lớp<span className="req">*</span>
        </legend>
        {inGroup.length === 0 ? (
          <div className="alert alert--warning">
            <Info size={18} />
            <div>Không có lớp nào phù hợp trong điểm trường và năm học này. Liên hệ Hiệu trưởng để mở lớp.</div>
          </div>
        ) : (
          <div className="tr-class-grid" role="radiogroup">
            {inGroup.map((c) => {
              const full = c.enrolledCount >= c.capacity && c.id !== currentClassId;
              const isCurrent = c.id === currentClassId;
              return (
                <label
                  key={c.id}
                  className={`tr-class-option ${classId === c.id ? 'tr-class-option--selected' : ''} ${full || isCurrent ? 'tr-class-option--disabled' : ''}`}
                >
                  <input
                    type="radio"
                    name="tr-class"
                    value={c.id}
                    checked={classId === c.id}
                    disabled={full || isCurrent}
                    onChange={() => onClassChange(c.id)}
                  />
                  <span className="tr-class-option__body">
                    <span className="fw-600">{c.name}</span>
                    <span className="muted text-sm">{ageGroupById(c.ageGroupId)?.shortName}</span>
                    <span className="text-sm">
                      Sĩ số: {c.enrolledCount}/{c.capacity}
                      {full && <span className="chip chip--red tr-chip-gap">Đã đủ</span>}
                      {isCurrent && <span className="chip chip--teal tr-chip-gap">Lớp hiện tại</span>}
                    </span>
                    {c.homeroomTeacherId && <span className="muted text-xs">GVCN: {userById?.(c.homeroomTeacherId)?.fullName || '—'}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {error && (
          <span className="field__error" role="alert">
            {error}
          </span>
        )}
      </fieldset>
    </div>
  );
}
