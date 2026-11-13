import { CalendarDays, SidebarExpand } from '@/components/ui/icons';
import { NotificationBell } from './NotificationBell';
import { HeaderSearch } from './HeaderSearch';
import { useSchoolYear } from '@/contexts/SchoolYearContext';

/**
 * Header: đường dẫn + tên trang bên trái (trang đưa lên qua `crumbRef`) · ô tìm chức năng · năm học · thông báo
 * (tài khoản ở đáy sidebar). Nút thu gọn sidebar nằm trong sidebar; header chỉ có nút mở menu khi sidebar là ngăn kéo.
 */
export function Header({ role, showMenuButton, menuOpen, onToggleSidebar, crumbRef }) {
  const { schoolYear, setSchoolYear, schoolYears } = useSchoolYear();
  return (
    <header className="header no-print">
      {showMenuButton && (
        <button className="icon-btn" onClick={onToggleSidebar} aria-label="Mở menu" aria-expanded={menuOpen} title="Mở menu">
          <SidebarExpand size={22} />
        </button>
      )}
      <div className="header__crumb" ref={crumbRef} />
      <div className="header__center">
        <HeaderSearch role={role} />
      </div>
      <label className="header__year" title="Năm học">
        <CalendarDays size={18} aria-hidden className="header__year-icon" />
        <select
          className="select header__year-select"
          aria-label="Năm học"
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
        >
          {schoolYears.length === 0 && <option value="">Chưa có năm học</option>}
          {schoolYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.statusLabel ? `${y.label} · ${y.statusLabel}` : y.label}
            </option>
          ))}
        </select>
      </label>
      <NotificationBell />
    </header>
  );
}
