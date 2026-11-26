import { useEffect, useState } from 'react';
import { TextField } from '@/components';

/** Ô số trong bảng cân đối: gõ xong (rời ô hoặc Enter) mới báo giá trị mới để BE tính lại một lần. */
export function NumberCell({ value, max, disabled, label, onCommit }) {
  const shown = value == null ? '' : String(Math.round(Number(value) * 1000) / 1000);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);

  const commit = () => {
    const next = Number(text);
    if (text === '' || Number.isNaN(next) || next < 0 || next > max) return setText(shown);
    if (next !== Number(shown)) onCommit(next);
    return undefined;
  };

  return (
    <TextField
      className="input td-bal__input"
      type="number"
      min={0}
      max={max}
      step="any"
      value={text}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}
