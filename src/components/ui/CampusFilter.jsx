import { useId } from 'react';

/**
 * Ô chọn điểm trường dùng chung (DESIGN §6.3, §14.1). Chỉ hiện khi có từ 2 điểm trường để chọn.
 * campuses: [{ id, name }]; value: id đang chọn ('' = tất cả); onChange(id).
 */
export function CampusFilter({ campuses, value, onChange, label = 'Điểm trường', allLabel = 'Tất cả điểm trường', className = '' }) {
  const id = useId();
  if (!campuses || campuses.length < 2) return null;
  return (
    <div className={`campus-filter ${className}`}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {campuses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
