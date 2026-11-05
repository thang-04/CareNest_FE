import { Children, cloneElement, useId } from 'react';
import { FormField } from '@/components/form/FormField';
import { ExamSheetBand, ExamSheetTable } from './exam/ExamFields';
import { PortraitPicker } from './PortraitPicker';

export function IntakeSheet({ title, children }) {
  return (
    <ExamSheetTable label={title}>
      <ExamSheetBand primary>{title}</ExamSheetBand>
      {Children.toArray(children).map((child, index) => cloneElement(child, { sheet: true, number: index + 1 }))}
    </ExamSheetTable>
  );
}

export function IntakeField({ sheet = false, number, label, required, children, ...props }) {
  const id = useId();
  if (!sheet)
    return (
      <FormField label={label} required={required} {...props}>
        {children}
      </FormField>
    );
  return (
    <tr>
      <td className="num">{number}</td>
      <th scope="row" id={id + '-label'}>
        <label htmlFor={id}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      </th>
      <td>
        <FormField {...props}>{cloneElement(children, { id, 'aria-labelledby': id + '-label' })}</FormField>
      </td>
    </tr>
  );
}

/** A portrait upload row that belongs to the same intake sheet as its person details. */
export function IntakePortraitField({ label, required = false, number, ...props }) {
  const id = useId();
  return (
    <tr>
      <td className="num">{number}</td>
      <th scope="row" id={id + '-label'}>
        <label htmlFor={id}>
          {label}
          {required && <span className="req">*</span>}
        </label>
      </th>
      <td>
        <PortraitPicker label={label} embedded inputId={id} labelledBy={id + '-label'} {...props} />
      </td>
    </tr>
  );
}

export function IntakeTextField({ value, onChange, maxLength = 100, disabled, ...props }) {
  return (
    <IntakeField {...props}>
      <input className="input" value={value ?? ''} maxLength={maxLength} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </IntakeField>
  );
}

export function IntakeNumberField({ value, onChange, min, max, step, disabled, ...props }) {
  return (
    <IntakeField {...props}>
      <input
        type="number"
        inputMode="decimal"
        className="input"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </IntakeField>
  );
}

export function IntakeChoiceField({ name, options, value, onChange, disabled, required = true, ...props }) {
  return (
    <IntakeField required={required} {...props}>
      <fieldset className="tr-fieldset">
        <div className="tr-exam-sheet__options">
          {options.map((option) => (
            <label key={option.value} className="radio">
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={value === option.value}
                disabled={disabled || option.disabled}
                onChange={() => onChange(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    </IntakeField>
  );
}
