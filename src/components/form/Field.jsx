import { forwardRef } from 'react';
import { FormField } from './FormField';

/*
 * Ô nhập chuẩn = nhãn + ô + gợi ý / lỗi trong một component, dùng thay cho <input>/<select>/<textarea> viết tay.
 * `error` là thông báo lỗi của ô (validation phía client hoặc lỗi field BE trả về). `ref` trỏ vào ô (để focus).
 *
 * <TextField label="Tên nhà cung cấp" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
 * <SelectField label="Trạng thái" value={status} onChange={…} options={[{ value: 'ACTIVE', label: 'Đang dùng' }]} placeholder="Tất cả" />
 */
const split = ({ label, required, error, hint, fieldClassName, ...control }) => ({
  field: { label, required, error, hint, className: fieldClassName },
  control,
});
// Không nhãn, không lỗi, không gợi ý (ô lọc trong .filter-bar, dùng aria-label) ⇒ không bọc .field để giữ bố cục hàng lọc
const wrap = (field, control) => (field.label || field.error || field.hint ? <FormField {...field}>{control}</FormField> : control);

export const TextField = forwardRef(function TextField(props, ref) {
  const { field, control } = split(props);
  return wrap(field, <input className="input" ref={ref} {...control} />);
});

export const TextAreaField = forwardRef(function TextAreaField(props, ref) {
  const { field, control } = split(props);
  return wrap(field, <textarea className="textarea" ref={ref} {...control} />);
});

export const SelectField = forwardRef(function SelectField({ options = [], placeholder, children, ...props }, ref) {
  const { field, control } = split(props);
  return wrap(
    field,
    <select className="select" ref={ref} {...control}>
      {placeholder != null && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
      {children}
    </select>,
  );
});
