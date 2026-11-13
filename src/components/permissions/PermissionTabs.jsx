import { NavLink, useLocation } from 'react-router-dom';
import '@/styles/modules/permissions.css';

/** Thanh 3 tab điều hướng giữa các trang phân quyền; nút của trang nằm ở đầu trang (`.page__head`), không chen vào hàng tab. */
export function PermissionTabs() {
  const { pathname } = useLocation();

  const tabs = [
    { key: 'roles', label: 'Quyền theo vai trò', to: '/school/roles' },
    { key: 'overrides', label: 'Quyền ngoại lệ từng người', to: '/permissions/overrides' },
    { key: 'history', label: 'Lịch sử thay đổi', to: '/permissions/history' },
  ];

  const isRolesActive = pathname === '/permissions' || pathname === '/permissions/roles' || pathname === '/school/roles';

  return (
    <div className="permission-tabs-bar">
      <nav className="tabs permission-tabs" aria-label="Trung tâm phân quyền">
        {tabs.map((tab) => {
          const active = tab.key === 'roles' ? isRolesActive : pathname === tab.to;
          return (
            <NavLink key={tab.key} to={tab.to} aria-current={active ? 'page' : undefined} className={`tab ${active ? 'tab--active' : ''}`}>
              {tab.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
