export function RadioGroup({ name, value, options, onChange, disabled = false, className, 'aria-label': ariaLabel }) {
  return (
    <div className={className} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <label key={option.value} className={`${option.className || ''} ${checked ? 'is-on' : ''}`.trim()}>
            <input
              type="radio"
              className="sr-only"
              name={name}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
