import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, Search } from '@/components/ui/icons';
import { useClickOutside } from '@/hooks/useClickOutside';
import { getMenuForRole } from './menuConfig';
import { getQuickActionsForRole } from './quickActions';

// Bỏ dấu tiếng Việt từng ký tự để chỉ số trong chuỗi gốc và chuỗi đã chuẩn hoá khớp nhau (dùng để tô chữ khớp)
const fold = (s) =>
  Array.from(s, (ch) => ch.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().charAt(0)).join('');

function Highlight({ text, query }) {
  const q = fold(query.trim());
  const at = q ? fold(text).indexOf(q) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}

/** Danh sách mục tìm được: chức năng trong menu của vai trò + thao tác tạo nhanh. Không gọi BE. */
function buildIndex(role) {
  const pages = [];
  getMenuForRole(role).forEach((entry) => {
    if (entry.to) pages.push({ label: entry.label, to: entry.to, group: 'Trang chính', icon: entry.icon });
    (entry.children || []).forEach((c) => pages.push({ label: c.label, to: c.to, group: entry.label, icon: entry.icon }));
  });
  const actions = getQuickActionsForRole(role).map((a) => ({ ...a, action: true }));
  return { pages, actions };
}

const MAX_PAGES = 7;
const MAX_ACTIONS = 4;

/** Ô tìm chức năng ở header (phương án A): gõ để lọc, Ctrl K để mở, ↑↓ chọn, Enter mở, Esc đóng. */
export function HeaderSearch({ role }) {
  const navigate = useNavigate();
  const listId = useId();
  const ref = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const index = useMemo(() => buildIndex(role), [role]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    const match = (it) => !q || fold(it.label).includes(q) || fold(it.group).includes(q);
    return [...index.pages.filter(match).slice(0, MAX_PAGES), ...index.actions.filter(match).slice(0, MAX_ACTIONS)];
  }, [index, query]);

  const close = useCallback(() => {
    setOpen(false);
    setActive(0);
  }, []);
  useClickOutside(ref, close, open);

  // Ctrl K / ⌘K mở ô tìm ở mọi màn
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (item) => {
    if (!item) return;
    navigate(item.to);
    setQuery('');
    close();
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    } else if (e.key === 'Escape') {
      close();
      inputRef.current?.blur();
    }
  };

  const firstAction = results.findIndex((r) => r.action);
  const optionId = (i) => `${listId}-opt-${i}`;

  return (
    <div className="header-search" ref={ref}>
      <label className="header-search__box">
        <Search size={18} aria-hidden="true" />
        <input
          ref={inputRef}
          className="header-search__input"
          type="search"
          role="combobox"
          aria-label="Tìm chức năng, màn hình"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && results[active] ? optionId(active) : undefined}
          placeholder="Tìm chức năng, màn hình…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        <kbd className="header-search__kbd" aria-hidden="true">
          Ctrl K
        </kbd>
      </label>
      {open && (
        <div className="dropdown__panel header-search__panel">
          <ul className="header-search__list" id={listId} role="listbox" aria-label="Kết quả tìm kiếm">
            {results.map((item, i) => {
              const Icon = item.action ? item.icon || Plus : item.icon;
              return (
                <li key={`${item.to}-${item.action ? 'a' : 'p'}`} role="presentation">
                  {i === 0 && !item.action && <div className="header-search__group">Chức năng</div>}
                  {i === firstAction && <div className="header-search__group">Tạo nhanh</div>}
                  <div
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    className={`header-search__item ${i === active ? 'is-active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(item)}
                  >
                    <span className="header-search__icon">{Icon ? <Icon size={18} /> : null}</span>
                    <span className="header-search__text">
                      <Highlight text={item.label} query={query} />
                      <small>{item.group}</small>
                    </span>
                    {i === active && <ChevronRight size={16} className="header-search__go" aria-hidden="true" />}
                  </div>
                </li>
              );
            })}
          </ul>
          {!results.length && <div className="header-search__empty">Không có chức năng nào khớp “{query.trim()}”.</div>}
          <div className="header-search__foot" aria-hidden="true">
            <span>↑↓ chọn</span>
            <span>Enter mở</span>
            <span>Esc đóng</span>
          </div>
        </div>
      )}
    </div>
  );
}
