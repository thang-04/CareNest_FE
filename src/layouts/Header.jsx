import { CalendarDays, SidebarExpand } from '@/components/ui/icons';
import { NotificationBell } from './NotificationBell';
import { HeaderSearch } from './HeaderSearch';
import { QuickCreateMenu } from './QuickCreateMenu';
import { useSchoolYear } from '@/contexts/SchoolYearContext';

/**
 * Header: năm học (ngữ cảnh dữ liệu) bên trái · ô tìm chức năng ở giữa · Tạo nhanh · thông báo (tài khoản ở đáy sidebar).
 * Nút thu gọn sidebar nằm trong sidebar; header chỉ có nút mở menu khi sidebar là ngăn kéo (màn hẹp).
 */
export function Header({ role, showMenuButton, menuOpen, onToggleSidebar }) {
  const { schoolYear, setSchoolYear, schoolYears } = useSchoolYear();
  return (
    <header className="header no-print">
      {showMenuButton && (
        <button className="icon-btn" onClick={onToggleSidebar} aria-label="Mở menu" aria-expanded={menuOpen} title="Mở menu">
          <SidebarExpand size={22} />
        </button>
      )}
      <label className="header__year" title="Năm học">
        <CalendarDays size={18} aria-hidden className="header__year-icon" />
        <select
          className="select header__year-select"
          aria-label="Năm học"
          value={schoolYear}
          onChange={(e) => setSchoolYear(e.target.value)}
        >
          {schoolYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.statusLabel ? `${y.label} · ${y.statusLabel}` : y.label}
            </option>
          ))}
        </select>
      </label>
      <div className="header__center">
        <HeaderSearch role={role} />
      </div>
      <QuickCreateMenu role={role} />
      <NotificationBell />
    </header>
  );
}
