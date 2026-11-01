import { YEAR_STATUS_LABELS } from '@/models/school-config/schoolConfigConstants';

/** School year filter used on the configuration screens (list comes from the school-config service). */
export function YearPicker({ years, value, onChange, id = 'sc-year' }) {
  return (
    <div className="sc-inline-field">
      <label className="field__label" htmlFor={id}>
        Năm học
      </label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
        {years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.name} · {YEAR_STATUS_LABELS[y.status]}
          </option>
        ))}
      </select>
    </div>
  );
}
