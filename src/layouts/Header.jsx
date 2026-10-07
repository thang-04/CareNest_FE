import { Menu } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { UserMenu } from './UserMenu';
import { useSchoolYear } from '@/contexts/SchoolYearContext';

/** Same header for every role: menu toggle · school year · notifications · account. */
export function Header({ collapsed, onToggleSidebar }) {
  const { schoolYear, setSchoolYear, schoolYears } = useSchoolYear();
  return (
    <header className="header no-print">
      <button
        className="icon-btn"
        onClick={onToggleSidebar}
        aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        aria-expanded={!collapsed}
        title={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
      >
        <Menu size={22} />
      </button>
      <label className="row header__year">
        <span>Năm học:</span>
        <select className="select header__year-select" value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)}>
          {schoolYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label}
            </option>
          ))}
        </select>
      </label>
      <div className="spacer" />
      <NotificationBell />
      <div className="header__divider" />
      <UserMenu />
    </header>
  );
}
