import { Building } from 'lucide-react';

export function CampusPicker({ campuses, value, onChange, error, disabled, id, ariaLabel }) {
  return (
    <>
      <select
        id={id}
        className={`select ${error ? 'select--error' : ''}`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label={ariaLabel}
      >
        <option value="">Chọn campus...</option>
        {campuses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {error && <div className="field__error">{error}</div>}
    </>
  );
}

/** Campus info card shown under the picker for inter-campus transfers. */
export function CampusInfoCard({ campus, tone = 'blue' }) {
  if (!campus) return null;
  return (
    <div className={`campus-card campus-card--${tone}`}>
      <div className="campus-card__img">
        <Building size={26} />
      </div>
      <div>
        <div className="fw-600">{campus.shortName}</div>
        <div className="text-2 text-sm">{campus.address}</div>
        <div className="text-2 text-sm">Điện thoại: {campus.phone}</div>
      </div>
    </div>
  );
}
