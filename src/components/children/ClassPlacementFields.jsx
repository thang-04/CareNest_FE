import { Info } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';
import { ClassFillBadge } from '@/components/school-config/SchoolConfigBadges';
import { AGE_GROUPS } from '@/models/School';
import { sameId } from '@/services/http/idStrings';

/**
 * Age group + class choice (SRS #29). Capacity numbers come from the service; the service re-checks them on save.
 * classes: [{ id, name, ageGroupId, campusId, capacity, enrolledCount, homeroomTeacherId }].
 * ageGroups: nhóm tuổi của năm học (BE /school-structure hoặc AGE_GROUPS của mock).
 * campuses: điểm trường được chọn; từ 2 điểm trường (Hiệu trưởng, PHT toàn trường) hiện ô Điểm trường và chỉ hiện lớp của
 * điểm trường đó (hai điểm trường có lớp trùng tên).
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
  campuses = [],
  campusId = '',
  onCampusChange,
  campusError,
  ageGroups = AGE_GROUPS,
}) {
  const pickCampus = campuses.length > 1;
  const groupById = (id) => ageGroups.find((g) => sameId(g.id, id)) || null;
  const inCampus = pickCampus ? classes.filter((c) => sameId(c.campusId, campusId)) : classes;
  const inGroup = inCampus.filter((c) => !ageGroupId || sameId(c.ageGroupId, ageGroupId));
  const mismatch = suggestedAgeGroupId && ageGroupId && !sameId(suggestedAgeGroupId, ageGroupId);
  const req = required && <span className="req">*</span>;

  return (
    <div className="stack gap-3-5">
      {/* Điểm trường, nhóm tuổi cùng một hàng khi đủ rộng; hẹp thì xếp dọc */}
      <div className="tr-placement-filters">
        {pickCampus && (
          <FormField label="Điểm trường" required error={campusError}>
            <select className="select" value={campusId} onChange={(e) => onCampusChange(e.target.value)}>
              <option value="">Chọn điểm trường</option>
              {campuses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.shortName || c.name}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <div className="field">
          <label className="field__label" htmlFor="tr-age-group">
            Nhóm tuổi{req}
          </label>
          <select id="tr-age-group" className="select" value={ageGroupId} onChange={(e) => onAgeGroupChange(e.target.value)}>
            <option value="">Tất cả nhóm tuổi</option>
            {ageGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {sameId(g.id, suggestedAgeGroupId) ? ' – phù hợp độ tuổi' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      {mismatch && (
        <div className="alert alert--warning">
          <Info size={18} />
          <div>
            Theo ngày sinh, trẻ thường học nhóm <b>{groupById(suggestedAgeGroupId)?.shortName}</b>. Kiểm tra lại trước khi xếp lớp.
          </div>
        </div>
      )}
      <fieldset className="tr-fieldset">
        <legend className="field__label">Lớp{req}</legend>
        {!required && classId && (
          <div className="row row--wrap gap-2 mb-12">
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => onClassChange('')}>
              Bỏ chọn lớp
            </button>
          </div>
        )}
        {pickCampus && !campusId ? (
          <p className="muted text-sm">Chọn điểm trường để xem lớp.</p>
        ) : inCampus.length === 0 ? (
          <div className="alert alert--warning">
            <Info size={18} />
            <div>Điểm trường này chưa có lớp nào trong năm học đang hoạt động. Lớp do Hiệu trưởng mở ở màn Nhóm tuổi &amp; lớp.</div>
          </div>
        ) : inGroup.length === 0 ? (
          // Nhóm tuổi tự gợi ý theo ngày sinh có thể chưa có lớp: nói rõ nhóm nào và cho xem lớp mọi nhóm tuổi
          <div className="alert alert--warning">
            <Info size={18} />
            <div className="stack gap-2">
              <span>
                Chưa có lớp <b>{groupById(ageGroupId)?.name}</b> ở {pickCampus ? 'điểm trường này' : 'phạm vi của bạn'} trong năm học đang
                hoạt động. Lớp do Hiệu trưởng mở ở màn Nhóm tuổi &amp; lớp.
              </span>
              <span>
                <button type="button" className="btn btn--sm" onClick={() => onAgeGroupChange('')}>
                  Xem lớp mọi nhóm tuổi
                </button>
              </span>
            </div>
          </div>
        ) : (
          <div className="tr-class-grid" role="radiogroup">
            {inGroup.map((c) => {
              const full = c.enrolledCount >= c.capacity && !sameId(c.id, currentClassId);
              const isCurrent = sameId(c.id, currentClassId);
              const isSelected = sameId(classId, c.id);
              const isDisabled = full || isCurrent;
              const toggle = () => {
                // Bắt buộc (màn Xếp lớp): radio giữ 1 lựa chọn, click card đang chọn vẫn giữ.
                // Không bắt buộc (tiếp nhận trẻ): click card đang chọn thì bỏ chọn (về trạng thái chờ xếp lớp).
                if (isSelected && !required) onClassChange('');
                else if (!isSelected) onClassChange(c.id);
              };
              return (
                <label
                  key={c.id}
                  className={`tr-class-option ${isSelected ? 'tr-class-option--selected' : ''} ${isDisabled ? 'tr-class-option--disabled' : ''}`}
                  onClick={(e) => {
                    // Quản lý tự chọn/bỏ chọn (radio native không bỏ chọn được khi đã chọn). preventDefault chặn
                    // activation mặc định của label, toggle xử lý 1 điểm, radio React-controlled giữ đúng 1 lựa chọn.
                    if (isDisabled) return;
                    e.preventDefault();
                    toggle();
                  }}
                >
                  <input type="radio" name="tr-class" value={c.id} checked={isSelected} disabled={isDisabled} />
                  <span className="tr-class-option__body">
                    <span className="fw-600">{c.name}</span>
                    <span className="muted text-sm">{groupById(c.ageGroupId)?.shortName}</span>
                    <span className="text-sm">
                      Sĩ số: {c.enrolledCount}/{c.capacity}
                      {full && (
                        <span className="tr-chip-gap">
                          <ClassFillBadge status="FULL" />
                        </span>
                      )}
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
