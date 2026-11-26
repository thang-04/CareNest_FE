import { useEffect, useState } from 'react';
import { TextField } from '@/components';

// Ô hiện dấu phẩy thập phân như các cột số trong bảng; gõ dấu chấm hay dấu phẩy đều nhận
const toText = (value) => (value == null ? '' : String(Math.round(Number(value) * 1000) / 1000).replace('.', ','));
const toNumber = (text) => Number(text.trim().replace(',', '.'));

/** Ô số trong bảng cân đối: gõ xong (rời ô hoặc Enter) mới báo giá trị mới để BE tính lại một lần. */
export function NumberCell({ value, max, disabled, label, onCommit }) {
  const shown = toText(value);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);

  const commit = () => {
    const next = toNumber(text);
    if (text.trim() === '' || Number.isNaN(next) || next < 0 || next > max) return setText(shown);
    if (next !== toNumber(shown)) onCommit(next);
    return undefined;
  };

  return (
    <TextField
      className="input td-bal__input"
      inputMode="decimal"
      value={text}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}
