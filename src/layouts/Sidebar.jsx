import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { getMenuForRole } from './menuConfig';

const OPEN_GROUPS_KEY = 'carenest.sidebar.openGroups';

const isActivePath = (pathname, to) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

const readOpenGroups = () => {
  try {
    return JSON.parse(localStorage.getItem(OPEN_GROUPS_KEY)) || {};
  } catch {
    return {};
  }
};

/**
 * Left menu. Groups (e.g. "Cơ sở vật chất") open/close on click with a slide
 * animation. When the whole sidebar is collapsed, clicking a group icon expands
 * the sidebar, and hovering shows the sub-menu as a flyout.
 */
export function Sidebar({ role, collapsed, onExpand }) {
  const { pathname } = useLocation();
  const menu = getMenuForRole(role);
  const [open, setOpen] = useState(readOpenGroups);

  // Open the group that contains the current page when navigating.
  useEffect(() => {
    const group = menu.find((m) => m.children?.some((c) => isActivePath(pathname, c.to)));
    if (group) setOpen((o) => (o[group.label] ? o : { ...o, [group.label]: true }));
  }, [pathname, menu]);

  useEffect(() => {
    try {
      localStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(open));
    } catch {
      /* storage blocked: keep in memory only */
    }
  }, [open]);

  const toggleGroup = (label) => {
    if (collapsed) {
      onExpand();
      setOpen((o) => ({ ...o, [label]: true }));
      return;
    }
    setOpen((o) => ({ ...o, [label]: !o[label] }));
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__brand">
        <Logo collapsed={collapsed} />
      </div>
      <nav className="sidebar__nav" aria-label="Menu chính">
        {menu.map((item) => {
          const Icon = item.icon;
          if (!item.children) {
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} />
                <span className="nav-item__label">{item.label}</span>
              </NavLink>
            );
          }
          const groupActive = item.children.some((c) => isActivePath(pathname, c.to));
          const expanded = !!open[item.label] && !collapsed;
          const subId = `nav-sub-${item.label}`;
          return (
            <div key={item.label} className="nav-group">
              <button
                type="button"
                className={`nav-item ${groupActive ? 'nav-item--group-active' : ''}`}
                onClick={() => toggleGroup(item.label)}
                aria-expanded={expanded}
                aria-controls={subId}
              >
                <Icon size={20} />
                <span className="nav-item__label">{item.label}</span>
                <ChevronDown size={16} className={`nav-item__chev ${expanded ? 'nav-item__chev--open' : ''}`} />
              </button>

              <div id={subId} className={`nav-sub-wrap ${expanded ? 'nav-sub-wrap--open' : ''}`}>
                <div className="nav-sub" inert={expanded ? undefined : ''}>
                  {item.children.map((child) => (
                    <NavLink
                      key={child.label}
                      to={child.to}
                      className={() => `nav-sub__item ${isActivePath(pathname, child.to) ? 'nav-sub__item--active' : ''}`}
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              </div>

              {collapsed && (
                <div className="nav-flyout" role="menu" aria-label={item.label}>
                  <div className="nav-flyout__title">{item.label}</div>
                  {item.children.map((child) => (
                    <NavLink
                      key={child.label}
                      to={child.to}
                      role="menuitem"
                      className={() => `nav-sub__item ${isActivePath(pathname, child.to) ? 'nav-sub__item--active' : ''}`}
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
