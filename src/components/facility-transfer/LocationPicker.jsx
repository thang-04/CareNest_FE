import { LOCATION_TYPE_LABELS, locationLabel } from '@/models/Location';

/** Select of classes/rooms of one campus, filtered by allowed location types. */
export function LocationPicker({
  locations,
  campusId,
  allowedTypes,
  value,
  onChange,
  excludeId,
  error,
  disabled,
  id,
  placeholder = 'Chọn lớp/phòng...',
  ariaLabel,
}) {
  const options = locations.filter((l) => l.campusId === campusId && (!allowedTypes || allowedTypes.includes(l.type)));
  const groups = options.reduce((acc, l) => {
    (acc[l.type] = acc[l.type] || []).push(l);
    return acc;
  }, {});
  return (
    <>
      <select
        id={id}
        className={`select ${error ? 'select--error' : ''}`}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || !campusId}
        aria-label={ariaLabel}
      >
        <option value="">{campusId ? placeholder : 'Chọn campus trước'}</option>
        {Object.entries(groups).map(([type, list]) => (
          <optgroup key={type} label={LOCATION_TYPE_LABELS[type]}>
            {list.map((l) => (
              <option key={l.id} value={l.id} disabled={l.id === excludeId}>
                {locationLabel(l)}
                {l.id === excludeId ? ' (đang là nơi đi)' : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {error && <div className="field__error">{error}</div>}
    </>
  );
}
