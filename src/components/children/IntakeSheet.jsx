import { Children, cloneElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from '@/components/ui/icons';
import { normalizeText } from '@/utils/format';
import { FormField } from '@/components/form/FormField';
import { ExamSheetBand, ExamSheetTable } from './exam/ExamFields';
import { PortraitPicker } from './PortraitPicker';

/** band=false: bỏ dải tiêu đề khi khung bọc ngoài đã có tên (thẻ phụ huynh); title vẫn là tên bảng cho trình đọc màn hình. */
export function IntakeSheet({ title, children, band = true }) {
  return (
    <ExamSheetTable label={title}>
      {band && <ExamSheetBand primary>{title}</ExamSheetBand>}
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
        <div className={`tr-exam-sheet__options${options.length <= 2 ? ' tr-exam-sheet__options--pair' : ''}`}>
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
 * Ô bảng cho một nhóm radio kèm chi tiết điều kiện (khai báo sức khỏe khi tiếp nhận: chọn "Có" ⇒ ô nhập thêm hiện ra).
 * children = chi tiết hiện khi đang chọn (chips, ô nhập phụ, ngày); hiển thị ngay dưới nhóm radio trong cùng ô, như ô kết quả của
 * phiếu khám. number do IntakeSheet ghi vào.
 */
export function IntakeChoiceRow({ number, label, name, options, value, onChange, required, error, hint, children }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <tr>
      <td className="num">{number}</td>
      <th scope="row" id={`${id}-label`}>
        {label}
        {required && <span className="req">*</span>}
      </th>
      <td>
        <fieldset className="tr-fieldset" aria-labelledby={`${id}-label`} aria-describedby={describedBy}>
          <div className={`tr-exam-sheet__options${options.length <= 2 ? ' tr-exam-sheet__options--pair' : ''}`}>
            {options.map((o) => (
              <label key={o.value} className="radio">
                <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>
        {children ? <div className="tr-exam-sheet__cell-detail">{children}</div> : null}
        {error ? (
          <span className="field__error" id={`${id}-error`} role="alert">
            {error}
          </span>
        ) : (
          hint && (
            <span className="field__hint" id={`${id}-hint`}>
              {hint}
            </span>
          )
        )}
      </td>
    </tr>
  );
}

/**
 * Hàng giá trị chỉ xem của bảng tiếp nhận (bước Xem lại & xác nhận, tóm tắt khai báo): TT | nhãn | giá trị.
 * Khác IntakeField (đóng FormField + ô nhập) ở chỗ ô kết quả chỉ hiện nội dung đọc, nên dùng cho màn xem lại.
 */
export function IntakeSheetValueRow({ number, label, children, required = false }) {
  return (
    <tr>
      <td className="num">{number}</td>
      <th scope="row">
        {label}
        {required && <span className="req">*</span>}
      </th>
      <td>{children}</td>
    </tr>
  );
}

// Khớp SearchSelect: khoảng cách panel–ô và chiều cao tối đa panel (list 300 + đệm) để quyết định mở lên/xuống.
const SUGGEST_PANEL_GAP = 6;
const SUGGEST_PANEL_MAX = 320;

/**
 * Ô nhập tự do kèm dropdown gợi ý (click vào ô hiện danh sách, gõ để lọc; bỏ dấu, không phân biệt hoa thường).
 * suggestions: danh sách chuỗi cố định; filterSuggestions(query) thay cách lọc mặc định khi cần.
 * Giữ giá trị người nhập tự do — không chọn vẫn nhập được. Danh sách nổi qua portal (cùng panel với SearchSelect)
 * để bảng/khung cuộn không cắt mất; thiếu chỗ phía dưới thì mở lên trên.
 */
export function IntakeSuggestField({
  value,
  onChange,
  suggestions = [],
  filterSuggestions,
  maxLength = 100,
  placeholder,
  disabled,
  ...props
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Vừa focus (chưa gõ) ⇒ hiện đủ danh sách; chỉ lọc khi người dùng gõ. Sửa hồ sơ có sẵn giá trị vẫn mở được dropdown.
  const [typed, setTyped] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);
  const inputRef = useRef(null);
  const controlRef = useRef(null);
  const listRef = useRef(null);
  const blurTimer = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const id = useId();
  const q = normalizeText(query.trim());
  const filter =
    !typed || !q ? suggestions : filterSuggestions ? filterSuggestions(query) : suggestions.filter((s) => normalizeText(s).includes(q));
  const showList = open && filter.length > 0;

  const place = useCallback(() => {
    const r = controlRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < SUGGEST_PANEL_MAX && r.top > below;
    setPos(
      up
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + SUGGEST_PANEL_GAP }
        : { left: r.left, width: r.width, top: r.bottom + SUGGEST_PANEL_GAP },
    );
  }, []);

  useLayoutEffect(() => {
    if (showList) place();
  }, [showList, place]);

  useEffect(() => {
    if (!showList) return undefined;
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [showList, place]);

  // Mở hoặc đổi từ khóa: sáng mục đang chọn (nếu có) và cuộn tới nó.
  useEffect(() => {
    if (!open) return;
    const i = filter.indexOf(value);
    setActive(i >= 0 ? i : typed && filter.length ? 0 : -1);
  }, [open, query]); // eslint-disable-line react-hooks/exhaustive-deps -- chỉ đặt lại mục sáng khi mở hoặc đổi từ khóa

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, pos]);

  const pick = (s) => {
    onChange(s);
    setQuery(s);
    setOpen(false);
  };
  // Cleanup timer blur khi unmount.
  useEffect(() => () => clearTimeout(blurTimer.current), []);
  // Giá trị đổi từ ngoài (reset form, chọn tỉnh ⇒ xoá phường): ô cập nhật theo, trừ khi đang gõ.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setQuery(value ?? '');
  }, [value]);

  const onKeyDown = (e) => {
    if (e.key === 'Escape' && showList) {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!showList) {
        setOpen(true);
        return;
      }
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + filter.length) % filter.length);
    } else if (e.key === 'Enter' && showList && filter[active] != null) {
      e.preventDefault();
      pick(filter[active]);
    }
  };

  const panel =
    showList && pos
      ? createPortal(
          <div className="search-select__panel" style={pos}>
            <div className="search-select__list" role="listbox" id={`${id}-list`} ref={listRef}>
              {filter.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={String(value) === s}
                  data-active={i === active}
                  className="search-select__option"
                  onMouseEnter={() => setActive(i)}
                  // preventDefault giữ focus ở input, tránh blur đóng list trước khi chọn được.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(s);
                  }}
                >
                  <span className="search-select__text">{s}</span>
                  {String(value) === s && <Check size={16} className="search-select__check" />}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <IntakeField {...props}>
      <div className="tr-intake-suggest">
        <div ref={controlRef} className={`tr-intake-suggest__control ${showList ? 'tr-intake-suggest__control--open' : ''}`}>
          <input
            id={id}
            ref={inputRef}
            className="input"
            value={query}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={disabled}
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={showList}
            aria-controls={showList ? `${id}-list` : undefined}
            aria-autocomplete="list"
            onFocus={() => {
              clearTimeout(blurTimer.current);
              blurTimer.current = null;
              setQuery(value ?? '');
              setTyped(false);
              setOpen(true);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setTyped(true);
              onChange(e.target.value);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            onBlur={() => {
              // Click ra ngoài: đóng list, đồng bộ ô về giá trị đang chọn (value) — không xoá.
              blurTimer.current = setTimeout(() => {
                setQuery(valueRef.current ?? '');
                setOpen(false);
                blurTimer.current = null;
              }, 150);
            }}
          />
          <ChevronDown size={16} className="muted tr-intake-suggest__chevron" aria-hidden="true" />
        </div>
        {panel}
      </div>
    </IntakeField>
  );
}
