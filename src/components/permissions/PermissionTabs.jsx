import { NavLink, useLocation } from 'react-router-dom';
import '@/styles/modules/permissions.css';

export function PermissionTabs() {
  const { pathname } = useLocation();

  const tabs = [
    { key: 'roles', label: 'Quyền theo vai trò', to: '/permissions' },
    { key: 'overrides', label: 'Quyền ngoại lệ từng người', to: '/permissions/overrides' },
    { key: 'history', label: 'Lịch sử thay đổi', to: '/permissions/history' },
  ];

  const isRolesActive = pathname === '/permissions' || pathname === '/permissions/roles';

  return (
    <nav className="permission-tabs" aria-label="Trung tâm phân quyền">
      {tabs.map((tab) => {
        const active = tab.key === 'roles' ? isRolesActive : pathname === tab.to;
        return (
          <NavLink
            key={tab.key}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={`permission-tabs__link ${active ? 'permission-tabs__link--active' : ''}`}
          >
            {tab.label}
          </NavLink>
        );
      })}
    </nav>
  );
}
