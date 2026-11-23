import { lazy, Suspense, useState } from 'react';
import { FormField } from '@/components';
import { BODY_MAX, estimateTextLength } from '@/utils/announcement/richText.mjs';

// Thư viện soạn thảo nặng: chỉ nạp khi một form có ô Nội dung được mở, không nằm trong gói tải ban đầu
const RichTextEditorControl = lazy(() => import('./RichTextEditorControl'));

const formatCount = (count, max) => `${count.toLocaleString('vi-VN')} / ${max.toLocaleString('vi-VN')}`;

/**
 * Ô Nội dung có định dạng, dùng như TextAreaField: nhãn + ô + đếm ký tự chữ + lỗi.
 * `value` là HTML (dữ liệu cũ chỉ có chữ thường thì đổi bằng `textToHtml` trước). `onChange(html, text)`; html là '' khi trống.
 * `disabled` phải truyền rõ (ô soạn không nằm dưới `<fieldset disabled>` như ô thường).
 *
 * <RichTextEditor label="Nội dung" required value={bodyHtml} onChange={(html) => setBodyHtml(html)} error={errors.body} />
 */
export function RichTextEditor({
  label = 'Nội dung',
  required,
  value,
  onChange,
  error,
  hint,
  maxLength = BODY_MAX,
  disabled,
  fieldClassName,
}) {
  const [length, setLength] = useState(() => estimateTextLength(value));
  const over = length > maxLength;
  const count = `${formatCount(length, maxLength)} ký tự`;
  return (
    <Suspense
      fallback={
        <div className="field">
          <span className="field__label">{label}</span>
          <div className="rich-editor rich-editor--loading muted" role="status">
            Đang tải trình soạn…
          </div>
          <span className="field__hint">{count}</span>
        </div>
      }
    >
      <FormField
        label={label}
        required={required}
        className={fieldClassName}
        error={error || (over ? `Nội dung dài quá ${maxLength.toLocaleString('vi-VN')} ký tự` : undefined)}
        hint={hint ? `${count} · ${hint}` : count}
      >
        <RichTextEditorControl value={value} onChange={onChange} onStats={setLength} disabled={disabled} label={label} />
      </FormField>
    </Suspense>
  );
}
