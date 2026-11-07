import { Children, cloneElement, useId, useState } from 'react';
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

/**
 * Ô nhập tự do kèm dropdown gợi ý (click vào ô hiện danh sách, gõ để lọc; bỏ dấu, không phân biệt hoa thường).
 * suggestions: danh sách chuỗi cố định. Giữ giá trị người nhập tự do — không chọn vẫn nhập được.
 */
export function IntakeSuggestField({ value, onChange, suggestions = [], maxLength = 100, placeholder, disabled, ...props }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const id = useId();
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  const q = norm(query.trim());
  const filter = q ? suggestions.filter((s) => norm(s).includes(q)) : suggestions;
  const showList = open && filter.length > 0;

  const pick = (s) => {
    onChange(s);
    setQuery('');
    setOpen(false);
  };

  return (
    <IntakeField {...props}>
      <div className="tr-intake-suggest">
        <div className={`tr-intake-suggest__control ${showList ? 'tr-intake-suggest__control--open' : ''}`}>
          <input
            id={id}
            className="input"
            value={query}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={disabled}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={showList}
            aria-autocomplete="list"
            onFocus={() => {
              setQuery(value ?? '');
              setOpen(true);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              onChange(e.target.value);
              setOpen(true);
            }}
            onBlur={() => {
              setTimeout(() => {
                setQuery('');
                setOpen(false);
              }, 150);
            }}
          />
          <span className="tr-intake-suggest__caret" aria-hidden="true" />
        </div>
        {showList && (
          <ul className="tr-intake-suggest__list" role="listbox">
            {filter.map((s) => (
              <li key={s} role="option" aria-selected={String(value) === s}>
                <button
                  type="button"
                  className="tr-intake-suggest__item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </IntakeField>
  );
}
