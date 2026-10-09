import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Plus } from '@/components/ui/icons';
import { useClickOutside } from '@/hooks/useClickOutside';
import { getQuickActionsForRole } from './quickActions';

/** Nút "Tạo nhanh" ở header: các trang tạo mới mà vai trò được vào. Vai trò không có mục nào thì ẩn nút. */
export function QuickCreateMenu({ role }) {
  const actions = getQuickActionsForRole(role);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  if (!actions.length) return null;

  return (
    <div className="dropdown" ref={ref}>
      <button
        className="btn btn--primary header__create"
        onClick={() => setOpen((v) => !v)}
        aria-label="Tạo nhanh"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={17} /> <span className="header__create-label">Tạo nhanh</span> <ChevronDown size={15} />
      </button>
      {open && (
        <div className="dropdown__panel quick-menu" role="menu" aria-label="Tạo nhanh">
          <div className="header-search__group">Tạo nhanh</div>
          {actions.map(({ to, label, group, icon: Icon }) => (
            <Link key={to} to={to} role="menuitem" className="header-search__item" onClick={close}>
              <span className="header-search__icon">
                <Icon size={18} />
              </span>
              <span className="header-search__text">
                {label}
                <small>{group}</small>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
