import { Radio } from '@/components/form/Radio';

/**
 * Nhóm radio ngoài bảng khai báo: options = [{ value, label, disabled }]. Nhãn nhóm đặt ở FormField bọc ngoài (legend ẩn cho đọc màn hình).
 */
export function ChoiceGroup({ id, name, label, options, value, onChange, 'aria-describedby': describedBy, 'aria-invalid': invalid }) {
  return (
    <fieldset id={id} aria-describedby={describedBy} aria-invalid={invalid} className="tr-fieldset stack gap-2">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className={`radio ${option.disabled ? 'radio--disabled' : ''}`.trim()}>
          <Radio
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
