import { cloneElement, isValidElement, useId } from 'react';

/**
 * Standard field: label (+ required star) + control + hint / error.
 * The child control receives id, aria-invalid, aria-describedby and the error class automatically.
 *
 * <FormField label="Email" required error={errors.email} hint="Email trường cấp">
 *   <input className="input" value={email} onChange={...} />
 * </FormField>
 */
export function FormField({ label, required, error, hint, children, className = '' }) {
  const autoId = useId();
  const id = children?.props?.id || autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': !!error || undefined,
        'aria-describedby': describedBy,
        className: `${children.props.className || ''} ${error ? 'is-invalid' : ''}`.trim(),
      })
    : children;

  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      )}
      {control}
      {error ? (
        <span className="field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span className="field__hint" id={`${id}-hint`}>
            {hint}
          </span>
        )
      )}
    </div>
  );
}
