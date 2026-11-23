import { useState } from 'react';
import { Button, TextField } from '@/components';
import { Plus, X } from '@/components/ui/icons';

const SEPARATOR_LENGTH = 2; // "; " khi nối thành một chuỗi

/**
 * Danh sách nhập từng mục: gõ rồi bấm Thêm hoặc Enter, mỗi mục một chip bỏ được (dị ứng, tiền sử).
 * error: tô viền đỏ ô nhập; showError: hiện thêm câu lỗi khi nơi gọi chưa hiện. maxTotalLength: giới hạn chuỗi nối "A; B" mà BE nhận; vượt thì khóa Thêm. sanitize: chuẩn hóa mục trước khi thêm.
 */
export function ChipListInput({
  id,
  items,
  onChange,
  placeholder,
  maxItemLength,
  maxTotalLength,
  error,
  showError = false,
  ariaLabel,
  tone = 'red',
  sanitize = (x) => x,
  disabled = false,
  className = 'row gap-2 tr-state-text',
}) {
  const [draft, setDraft] = useState('');
  const text = sanitize(draft.trim());
  const totalAfter = items.reduce((n, x) => n + x.length + SEPARATOR_LENGTH, 0) + text.length;
  const tooLong = !!maxTotalLength && !!text && totalAfter > maxTotalLength;
  const message = (showError && error) || (tooLong ? `Tối đa ${maxTotalLength} ký tự cho cả mục` : '');
  const add = () => {
    if (!text || tooLong) return;
    if (!items.some((x) => x.toLowerCase() === text.toLowerCase())) onChange([...items, text]);
    setDraft('');
  };
  return (
    <div>
      <div className={className}>
        <TextField
          id={id}
          className={error ? 'input is-invalid' : 'input'}
          aria-invalid={error ? true : undefined}
          aria-label={ariaLabel}
          aria-describedby={message ? `${id}-error` : undefined}
          placeholder={placeholder}
          value={draft}
          maxLength={maxItemLength}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button icon={Plus} onClick={add} disabled={disabled || !text || tooLong}>
          Thêm
        </Button>
      </div>
      {items.length > 0 && (
        <div className="row row--wrap mt-8 gap-2">
          {items.map((x) => (
            <span key={x} className={`chip chip--${tone}`}>
              {x}
              {!disabled && (
                <Button
                  variant="icon"
                  className="tr-chip-remove"
                  aria-label={`Bỏ ${x}`}
                  onClick={() => onChange(items.filter((i) => i !== x))}
                >
                  <X size={12} />
                </Button>
              )}
            </span>
          ))}
        </div>
      )}
      {message && (
        <span id={`${id}-error`} className="field__error" role="alert">
          {message}
        </span>
      )}
    </div>
  );
}
