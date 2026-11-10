import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getMenuForRole } from '@/layouts/menuConfig';
import { alignCrumbs } from '@/utils/menuBreadcrumb';

/**
 * First line of every page in the app shell. items: [{ label, to? }] – the last item is the
 * current page and also becomes the browser tab title.
 * Tên nhóm và tên mục lấy theo sidebar của vai trò đang đăng nhập (utils/menuBreadcrumb) để breadcrumb luôn khớp sidebar;
 * trang chỉ quyết định các cấp con phía sau.
 */
export function Breadcrumb({ items }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const shown = alignCrumbs(items, getMenuForRole(user?.role, user), pathname);
  usePageTitle(shown[shown.length - 1]?.label);
  return (
    <nav className="breadcrumb no-print" aria-label="Breadcrumb">
      <Home size={15} />
      {shown.map((item, i) => (
        <Fragment key={`${i}-${item.label}`}>
          {i > 0 && <ChevronRight size={14} />}
          {item.to && i < shown.length - 1 ? (
            <Link to={item.to}>{item.label}</Link>
          ) : (
            <span className="breadcrumb__current">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
