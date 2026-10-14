import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, X } from '@/components/ui/icons';
import { DOMAIN_PREFIX, DOMAIN_SHORT, domainLabel } from '@/models/education-plan/educationPlanConstants';

/** Requirement codes (YCCĐ) as chips. */
export function CodeChips({ codes, empty = '—' }) {
  if (!codes?.length) return <span className="muted text-xs">{empty}</span>;
  return (
    <span className="ga-tags">
      {codes.map((c) => (
        <span key={c} className="chip chip--blue ga-code-chip">
          {c}
        </span>
      ))}
    </span>
  );
}

/**
 * Picks requirement codes from an approved theme plan (links theme -> week -> day).
 * options: [{ code, text, domain }]
 */
export function CodePicker({ options, value = [], onChange, label = 'Mã YCCĐ' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const toggle = (code) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  const filtered = options.filter((o) => !q || `${o.code} ${o.text}`.toLowerCase().includes(q.toLowerCase()));
  const groups = [...new Set(filtered.map((o) => o.domain))];

  return (
    <div className="ga-code-picker" ref={ref}>
      <div className="ga-tags">
        {value.map((c) => (
          <span key={c} className="chip chip--blue ga-code-chip">
            {c}
            <button type="button" className="ga-chip-x" aria-label={`Bỏ mã ${c}`} onClick={() => toggle(c)}>
              <X aria-hidden />
            </button>
          </span>
        ))}
        <button type="button" className="ga-chip-add" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Chọn ${label}`}>
          <Plus aria-hidden /> {value.length ? 'Mã' : label}
        </button>
      </div>
      {open && (
        <div className="ga-code-pop" role="listbox" aria-multiselectable="true" aria-label={label}>
          <input
            className="input"
            autoFocus
            placeholder="Tìm mã hoặc nội dung"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm mã YCCĐ"
          />
          <div className="ga-code-pop__list">
            {options.length === 0 && <p className="muted text-xs">Chủ đề chưa có mã YCCĐ.</p>}
            {groups.map((g) => (
              <div key={g}>
                <div className="ga-code-pop__group">{DOMAIN_SHORT[g] || g}</div>
                {filtered
                  .filter((o) => o.domain === g)
                  .map((o) => (
                    <button
                      key={o.code}
                      type="button"
                      role="option"
                      aria-selected={value.includes(o.code)}
                      className={`ga-code-opt ${value.includes(o.code) ? 'ga-code-opt--selected' : ''}`}
                      onClick={() => toggle(o.code)}
                    >
                      <span className="ga-code-check">{value.includes(o.code) && <Check aria-hidden />}</span>
                      <span className="ga-goal-code">{o.code}</span>
                      <span className="ga-code-text">{o.text}</span>
                    </button>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Collapsible group used by every step that edits many items. */
export function Group({ id, collapsed, onToggle, title, meta, actions, children }) {
  // Bấm vào bất kỳ chỗ nào trên dòng tiêu đề để thu gọn / mở rộng, trừ các ô nhập và nút bên trong.
  const onHeadClick = (e) => {
    if (e.target.closest('input, textarea, select, button, a, label')) return;
    onToggle();
  };
  return (
    <div className={`ga-domain ${collapsed ? 'ga-domain--collapsed' : ''}`} data-group={id}>
      <div className="ga-domain__head" onClick={onHeadClick}>
        <div className="row" style={{ flex: 1, minWidth: 0 }}>
          <button
            type="button"
            className="icon-btn ga-domain__toggle"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Mở rộng' : 'Thu gọn'}
            onClick={onToggle}
          >
            <ChevronDown aria-hidden />
          </button>
          <span className="ga-domain__bar" aria-hidden />
          {title}
        </div>
        <div className="row">
          {meta && <span className="muted text-xs">{meta}</span>}
          {actions}
        </div>
      </div>
      {!collapsed && <div className="ga-domain__body">{children}</div>}
    </div>
  );
}

/** Collapsed state of many groups. */
export function useCollapse() {
  const [collapsed, setCollapsed] = useState(() => new Set());
  return {
    collapsed,
    isCollapsed: (id) => collapsed.has(id),
    toggle: (id) =>
      setCollapsed((c) => {
        const n = new Set(c);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    setAll: (ids) => setCollapsed(new Set(ids)),
    clear: () => setCollapsed(new Set()),
  };
}

/** Một mục tiêu năm học (chế độ xem) kèm danh sách YCCĐ có mã của nó. */
export function GoalItemView({ item }) {
  return (
    <div>
      <div className="ga-goal-row ga-goal-row--read">
        <span className="ga-goal-code">{item.code}</span>
        <span>{item.text}</span>
      </div>
      {(item.requirements || []).map((r) => (
        <div key={r.id || r.code} className="ga-goal-row ga-goal-row--read ga-goal-check--child">
          <span className="ga-goal-code">{r.code}</span>
          <span className="text-sm">{r.text}</span>
        </div>
      ))}
    </div>
  );
}

/** Tiêu đề lĩnh vực kèm mã viết tắt (ví dụ "Phát triển thể chất · Mã: TC"). */
export function DomainTitle({ name, short = false }) {
  return (
    <>
      <h3>{short ? DOMAIN_SHORT[name] || name : domainLabel(name)}</h3>
      {DOMAIN_PREFIX[name] && <span className="chip chip--blue">Mã: {DOMAIN_PREFIX[name]}</span>}
    </>
  );
}
