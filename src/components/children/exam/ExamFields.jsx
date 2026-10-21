import { FormField } from '@/components/form/FormField';

/** Một câu của phiếu Phụ lục II: nhóm radio theo lựa chọn của mẫu. Lựa chọn bất thường đang chọn thì viền cảnh báo; option.disabled khóa riêng lựa chọn đó. */
export function ExamChoiceField({ name, label, options, value, onChange, error, hint, required = true, disabled }) {
  const flagged = options.find((o) => o.value === value)?.abnormal;
  return (
    <fieldset className={`field tr-fieldset tr-exam-choice ${flagged ? 'tr-exam-choice--flag' : ''}`}>
      <legend className="field__label">
        {label}
        {required && <span className="req">*</span>}
      </legend>
      <div className="tr-radio-row">
        {options.map((o) => (
          <label key={o.value} className={`radio ${disabled || o.disabled ? 'radio--disabled' : ''}`}>
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              disabled={disabled || o.disabled}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </fieldset>
  );
}

/** Nhóm ô tích (chọn nhiều), ví dụ tình trạng dinh dưỡng, kết luận. */
export function ExamCheckGroup({ label, options, values, onToggle, error, hint, required = true, disabled }) {
  return (
    <fieldset className="field tr-fieldset">
      <legend className="field__label">
        {label}
        {required && <span className="req">*</span>}
      </legend>
      <div className="tr-radio-row">
        {options.map((o) => (
          <label key={o.value} className={`checkbox ${disabled || o.disabled ? 'radio--disabled' : ''}`}>
            <input
              type="checkbox"
              checked={values.includes(o.value)}
              disabled={disabled || o.disabled}
              onChange={() => onToggle(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
      {error ? (
        <span className="field__error" role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </fieldset>
  );
}

/** Ô số của phiếu (cm, kg, lần/phút…). */
export function ExamNumberField({ label, value, onChange, error, hint, required, min, max, step = '0.1', disabled }) {
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      <input
        type="number"
        className="input"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  );
}

/** Ô chữ của phiếu. */
export function ExamTextField({ label, value, onChange, error, hint, required, maxLength = 100, disabled, multiline }) {
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      {multiline ? (
        <textarea
          className="textarea"
          rows={2}
          maxLength={maxLength}
          value={value ?? ''}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input className="input" maxLength={maxLength} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
    </FormField>
  );
}
