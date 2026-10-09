import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { CaretDown, SidebarCollapse, SidebarExpand, X } from '@/components/ui/icons';
import { Logo } from '@/components/brand/Logo';
import { getMenuForRole } from './menuConfig';
import { UserMenu } from './UserMenu';

const OPEN_GROUPS_KEY = 'carenest.sidebar.openGroups';

// Icon một màu theo chữ của mục (mục đang chọn mang màu primary qua CSS)
const iconChip = (item) => {
  const Icon = item.icon;
  return (
    <span className="nav-item__icon" aria-hidden="true">
      <Icon size={20} />
    </span>
  );
};

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
export function Sidebar({ role, collapsed, drawer = false, drawerOpen = false, onExpand, onToggle }) {
  const { pathname } = useLocation();
  const menu = getMenuForRole(role);
  const [open, setOpen] = useState(readOpenGroups);

  // Open the group that contains the current page when navigating.
  useEffect(() => {
    const group = menu.find((m) => m.children?.some((c) => isActivePath(pathname, c.to)));
    if (group) setOpen((o) => (o[group.label] ? o : { [group.label]: true }));
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
    // Chỉ mở một nhóm tại một thời điểm ⇒ menu ngắn, dễ tìm
    setOpen((o) => (o[label] ? {} : { [label]: true }));
  };

  // Mục "chung" (thông báo, tài khoản) tách xuống section dưới như design.md; danh sách mục vẫn theo role
  const isGeneral = (item) => item.to === '/notifications' || item.key === 'system';
  const renderItem = (item) => {
    if (!item.children) {
      return (
        <NavLink
          key={item.label}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
          title={collapsed ? item.label : undefined}
        >
          {iconChip(item)}
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
          {iconChip(item)}
          <span className="nav-item__label">{item.label}</span>
          <CaretDown size={14} className={`nav-item__chev ${expanded ? 'nav-item__chev--open' : ''}`} />
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
  };

  return (
    <aside
      className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''} ${drawer ? 'sidebar--drawer' : ''} ${drawerOpen ? 'sidebar--open' : ''}`}
    >
      {/* Logo về Trang chủ; nút thu gọn/mở rộng nằm ngay cạnh (ngăn kéo màn hẹp thì là nút đóng) */}
      <div className="sidebar__brand">
        <Link to="/" className="sidebar__home" aria-label="Về Trang chủ" title="Về Trang chủ">
          <Logo collapsed={collapsed} size={36} />
        </Link>
        <button
          type="button"
          className="icon-btn sidebar__toggle"
          onClick={onToggle}
          aria-label={drawer ? 'Đóng menu' : collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          title={drawer ? 'Đóng menu' : collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
          aria-expanded={drawer ? drawerOpen : !collapsed}
        >
          {drawer ? <X size={20} /> : collapsed ? <SidebarExpand size={20} /> : <SidebarCollapse size={20} />}
        </button>
      </div>
      <div className="sidebar__scroll">
        <div className="sidebar__label" aria-hidden="true">
          Menu
        </div>
        <nav className="sidebar__nav" aria-label="Menu chính">
          {menu.filter((item) => !isGeneral(item)).map(renderItem)}
        </nav>
        {menu.some(isGeneral) && (
          <>
            <div className="sidebar__label" aria-hidden="true">
              Chung
            </div>
            <nav className="sidebar__nav" aria-label="Menu chung">
              {menu.filter(isGeneral).map(renderItem)}
            </nav>
          </>
        )}
      </div>
      <div className="sidebar__footer">
        <UserMenu collapsed={collapsed} />
      </div>
    </aside>
  );
}
