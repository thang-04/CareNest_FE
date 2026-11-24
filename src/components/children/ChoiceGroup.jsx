import { Radio } from '@/components/form/Radio';

/**
 * Nhóm radio ngoài bảng khai báo: options = [{ value, label, disabled }]. Nhãn nhóm đặt ở FormField bọc ngoài (legend ẩn cho đọc màn hình).
 */
export function ChoiceGroup({ name, label, options, value, onChange }) {
  return (
    <fieldset className="tr-fieldset stack gap-2">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="radio">
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
