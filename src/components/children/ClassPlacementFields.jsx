import { Info } from '@/components/ui/icons';
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
  required = true,
}) {
  const inGroup = classes.filter((c) => !ageGroupId || c.ageGroupId === ageGroupId);
  const mismatch = suggestedAgeGroupId && ageGroupId && suggestedAgeGroupId !== ageGroupId;
  const req = required && <span className="req">*</span>;

  return (
    <div className="stack gap-3-5">
      <div className="field tr-field-narrow">
        <label className="field__label" htmlFor="tr-age-group">
          Nhóm tuổi{req}
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
        <legend className="field__label">Lớp{req}</legend>
        {!required && (
          <div className="row row--wrap gap-2 mb-12">
            <span className="muted text-sm">Có thể bỏ trống: trẻ ở trạng thái Chờ xếp lớp, xếp lớp sau tại màn Xếp lớp.</span>
            {classId && (
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => onClassChange('')}>
                Bỏ chọn lớp
              </button>
            )}
          </div>
        )}
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
