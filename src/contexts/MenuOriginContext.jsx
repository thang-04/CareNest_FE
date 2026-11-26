import { createContext, useContext, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getMenuForRole } from '@/layouts/menuConfig';
import { nextOrigin } from '@/utils/menuBreadcrumb';

const MenuOriginContext = createContext(null);

/** Mục sidebar nơi người dùng đi vào trang con của kế hoạch giáo dục (Duyệt, Quá hạn); null = theo đường dẫn. */
export const useMenuOrigin = () => useContext(MenuOriginContext);

/** Giữ mục nơi đi vào qua các trang con; sidebar và breadcrumb dùng chung một giá trị. */
export function MenuOriginProvider({ children }) {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const menu = useMemo(() => getMenuForRole(user?.role, user), [user]);
  const [origin, setOrigin] = useState(null);
  const next = nextOrigin(menu, pathname, search, origin);
  // Đổi trạng thái ngay khi vẽ: React vẽ lại tức thì nên cả cây con chỉ thấy giá trị mới
  if (next !== origin) setOrigin(next);
  return <MenuOriginContext.Provider value={next}>{children}</MenuOriginContext.Provider>;
}
