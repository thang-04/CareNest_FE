import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Search } from '@/components/ui/icons';
import { normalizeText } from '@/utils/format';

const SEARCH_THRESHOLD = 8;
const PANEL_GAP = 6;
const PANEL_MAX = 320;

/**
 * Ô chọn tự dựng thay `<select>` gốc: cùng dáng ô nhập, danh sách nổi (portal, không bị bảng cắt), phím ↑ ↓ Enter Esc.
 * options: [{ value, label, searchText?, render?, hint?, group? }]. Ô tìm tự hiện khi trên 8 mục (`searchable` ghi đè).
 * variant: 'field' (mặc định) | 'add' (nút "Thêm …" viền đứt, chọn xong không giữ giá trị — dùng cho chọn món).
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Chọn...',
  disabled,
  error,
  renderValue,
  ariaLabel,
  searchable,
  searchPlaceholder = 'Tìm kiếm...',
  heading,
  size,
  variant = 'field',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);
  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;

  const close = useCallback((refocus) => {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  }, []);

  const selected = variant === 'add' ? null : options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return q ? options.filter((o) => normalizeText(o.searchText || o.label).includes(q)) : options;
  }, [options, query]);

  // Đặt panel theo vị trí ô mở; thiếu chỗ phía dưới thì mở lên trên
  const place = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(Math.max(r.width, variant === 'add' ? 320 : 200), window.innerWidth - 32);
    const left = Math.min(Math.max(16, r.left), window.innerWidth - width - 16);
    const below = window.innerHeight - r.bottom;
    const up = below < PANEL_MAX && r.top > below;
    setPos(up ? { left, width, bottom: window.innerHeight - r.top + PANEL_GAP } : { left, width, top: r.bottom + PANEL_GAP });
  }, [variant]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target) && !panelRef.current?.contains(e.target)) close(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, close, place]);

  useEffect(() => {
    if (!open) return;
    const i = filtered.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : filtered.length ? 0 : -1);
  }, [open, query]); // eslint-disable-line react-hooks/exhaustive-deps -- chỉ đặt lại mục sáng khi mở hoặc đổi từ khóa

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (o) => {
    onChange(o.value, o);
    close(true);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (open) {
        e.stopPropagation();
        close(true);
      }
      return;
    }
    if (!open) {
      if (['ArrowDown', 'Enter', ' '].includes(e.key) && e.target === triggerRef.current) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!filtered.length) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    } else if (e.key === 'Tab') {
      close(false);
    }
  };

  let lastGroup;
  const panel =
    open && pos
      ? createPortal(
          <div className="search-select__panel" ref={panelRef} style={pos} onKeyDown={onKeyDown}>
            {heading && <div className="search-select__heading">{heading}</div>}
            {showSearch && (
              <div className="search-select__search">
                <Search size={16} className="muted" />
                <input
                  autoFocus
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label={searchPlaceholder}
                />
              </div>
            )}
            <div className="search-select__list" role="listbox" ref={listRef} aria-label={ariaLabel || placeholder}>
              {filtered.length === 0 && <div className="muted search-select__empty">Không tìm thấy kết quả</div>}
              {filtered.map((o, i) => {
                const groupHead = o.group && o.group !== lastGroup ? o.group : null;
                lastGroup = o.group;
                return (
                  <div key={o.value} role="presentation">
                    {groupHead && <div className="search-select__group">{groupHead}</div>}
                    <button
                      type="button"
                      role="option"
                      tabIndex={-1}
                      aria-selected={o.value === selected?.value}
                      data-active={i === active}
                      className="search-select__option"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(o)}
                    >
                      <span className="search-select__text">
                        {o.render ? o.render() : o.label}
                        {o.hint && <small>{o.hint}</small>}
                      </span>
                      {o.value === selected?.value && <Check size={16} className="search-select__check" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={`search-select ${size === 'sm' ? 'search-select--sm' : ''} ${className}`} ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        className={variant === 'add' ? 'search-select__add' : `search-select__control ${error ? 'select--error' : ''}`}
        onClick={() => !disabled && (open ? close(false) : setOpen(true))}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {variant === 'add' ? (
          <>
            <Plus size={16} />
            {placeholder}
          </>
        ) : (
          <>
            <span className="search-select__value">
              {selected ? renderValue ? renderValue(selected) : selected.label : <span className="muted">{placeholder}</span>}
            </span>
            <ChevronDown size={16} className="muted search-select__chevron" />
          </>
        )}
      </button>
      {panel}
    </div>
  );
}
