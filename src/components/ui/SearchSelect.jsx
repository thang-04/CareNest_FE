import { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import { normalizeText } from '@/utils/format';

/**
 * Searchable dropdown.
 * options: [{ value, label, searchText?, render? }]
 */
export function SearchSelect({ options, value, onChange, placeholder = 'Chọn...', disabled, error, renderValue, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return q ? options.filter((o) => normalizeText(o.searchText || o.label).includes(q)) : options;
  }, [options, query]);

  return (
    <div className="search-select" ref={ref}>
      <button
        type="button"
        className={`search-select__control ${error ? 'select--error' : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="search-select__value">
          {selected ? renderValue ? renderValue(selected) : selected.label : <span className="muted">{placeholder}</span>}
        </span>
        <ChevronDown size={16} className="muted" />
      </button>
      {open && (
        <div className="search-select__panel">
          <div className="search-select__search">
            <Search size={15} className="muted" />
            <input autoFocus placeholder="Tìm kiếm..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Tìm kiếm" />
          </div>
          <div className="search-select__list" role="listbox">
            {filtered.length === 0 && (
              <div className="muted" style={{ padding: 12 }}>
                Không tìm thấy kết quả
              </div>
            )}
            {filtered.map((o) => (
              <button
                type="button"
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={`search-select__option ${o.value === value ? 'search-select__option--active' : ''}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery('');
                }}
              >
                {o.render ? o.render() : o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
