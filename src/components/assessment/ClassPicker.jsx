import { useCallback, useRef, useState } from 'react';
import { Search, X } from '@/components/ui/icons';
import { useClickOutside } from '@/hooks/useClickOutside';
import { normalizeText } from '@/utils/format';

/**
 * Ô chọn lớp gõ tay được: gõ tên lớp ngay trong ô để lọc, danh sách chia theo nhóm tuổi,
 * nhiều điểm trường thì có nút lọc điểm trường. Phím ↑ ↓ chọn, Enter lấy lớp, Esc đóng.
 */
export function ClassPicker({ classes, ageGroups, campuses, value, onChange, disabled, error, placeholder = 'Tìm lớp, vd: Chồi 1' }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [campusId, setCampusId] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const close = useCallback(() => {
    setOpen(false);
    setText('');
  }, []);
  useClickOutside(ref, close, open);

  const campusIds = [...new Set(classes.map((c) => c.campusId))];
  const multiCampus = campusIds.length > 1;
  const campusLabel = (id) => {
    const c = campuses.find((x) => x.id === id);
    return c ? c.shortName || c.name : '';
  };
  const labelOf = (c) => (multiCampus && campusLabel(c.campusId) ? `${c.name} · ${campusLabel(c.campusId)}` : c.name);
  const selected = classes.find((c) => c.id === value);

  const kw = normalizeText(text.trim());
  const shown = classes.filter((c) => (!campusId || c.campusId === campusId) && (!kw || normalizeText(labelOf(c)).includes(kw)));
  // Nhóm theo nhóm tuổi theo thứ tự cấu hình; lớp chưa có nhóm tuổi xếp cuối
  const groups = [...ageGroups.map((g) => ({ id: g.id, name: g.name })), { id: '', name: 'Khác' }]
    .map((g) => ({
      ...g,
      items: shown
        .filter((c) => (ageGroups.some((x) => x.id === c.ageGroupId) ? c.ageGroupId === g.id : g.id === ''))
        .sort((a, b) => labelOf(a).localeCompare(labelOf(b), 'vi')),
    }))
    .filter((g) => g.items.length);
  const flat = groups.flatMap((g) => g.items);

  const pick = (c) => {
    onChange(c.id);
    close();
    inputRef.current?.blur();
  };
  // Nút Tìm: khớp đúng 1 lớp thì chọn luôn, không thì mở danh sách kết quả
  const search = () => {
    if (text.trim() && flat.length === 1) return pick(flat[0]);
    setOpen(true);
    inputRef.current?.focus();
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (flat.length ? (i + (e.key === 'ArrowDown' ? 1 : flat.length - 1)) % flat.length : 0));
    } else if (e.key === 'Enter') {
      // Không gửi form mở lại khi đang chọn lớp
      e.preventDefault();
      if (open && text.trim() && flat[active]) pick(flat[active]);
      else search();
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <div className={`class-picker ${open ? 'is-open' : ''}`} ref={ref}>
      <div className="search-submit">
        <label className={`search-box class-picker__box ${error ? 'is-invalid' : ''}`}>
          <Search size={16} className="muted" aria-hidden="true" />
          <span className="sr-only">Lớp cần mở lại</span>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            disabled={disabled}
            value={open ? text : selected ? labelOf(selected) : ''}
            placeholder={open && selected ? labelOf(selected) : placeholder}
            onFocus={() => {
              setOpen(true);
              setActive(0);
            }}
            // Ô vẫn đang focus (vừa chọn xong) thì bấm lại cũng mở danh sách
            onClick={() => setOpen(true)}
            onChange={(e) => {
              setText(e.target.value);
              setActive(0);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
          {open && text && (
            <button type="button" className="search-submit__clear" aria-label="Xóa từ khóa" onClick={() => setText('')}>
              <X size={14} />
            </button>
          )}
        </label>
        <button type="button" className="btn" onMouseDown={(e) => e.preventDefault()} onClick={search} disabled={disabled}>
          Tìm
        </button>
      </div>
      {open && (
        <div className="class-picker__panel">
          {multiCampus && (
            <div className="class-picker__campus" role="group" aria-label="Lọc điểm trường">
              {['', ...campusIds].map((id) => (
                <button
                  type="button"
                  key={id || 'all'}
                  className={`chip ${campusId === id ? 'chip--teal' : 'chip--gray'}`}
                  aria-pressed={campusId === id}
                  onClick={() => {
                    setCampusId(id);
                    setActive(0);
                    inputRef.current?.focus();
                  }}
                >
                  {id ? campusLabel(id) || id : 'Mọi điểm trường'}
                </button>
              ))}
            </div>
          )}
          <div className="class-picker__list" role="listbox">
            {groups.length === 0 && <div className="muted class-picker__empty">Không có lớp phù hợp</div>}
            {groups.map((g) => (
              <div key={g.id || 'none'} role="group" aria-label={g.name}>
                <div className="class-picker__group">
                  {g.name} <span className="muted">· {g.items.length} lớp</span>
                </div>
                {g.items.map((c) => {
                  const i = flat.indexOf(c);
                  return (
                    <button
                      type="button"
                      key={c.id}
                      role="option"
                      aria-selected={c.id === value}
                      className={`class-picker__option ${c.id === value ? 'is-selected' : ''} ${i === active ? 'is-active' : ''}`}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(c)}
                    >
                      {labelOf(c)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
