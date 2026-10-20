import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingState } from '@/components/ui/States';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { AreaGate } from '@/routes/RoleGuard';
import { useMediaQuery } from '@/hooks';
import './layout.css';

const COLLAPSED_KEY = 'carenest.sidebar.collapsed';
const NARROW_QUERY = '(max-width: 1023px)';

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

export function MainLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // Dưới 1024px sidebar thành drawer: ẩn mặc định, mở bằng nút menu
  const isNarrow = useMediaQuery(NARROW_QUERY);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* storage blocked: keep in memory only */
    }
  }, [collapsed]);

  useEffect(() => setDrawerOpen(false), [pathname, isNarrow]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const toggleSidebar = () => (isNarrow ? setDrawerOpen((o) => !o) : setCollapsed((c) => !c));

  return (
    <div className="app-shell">
      <Sidebar
        role={user.role}
        collapsed={!isNarrow && collapsed}
        drawer={isNarrow}
        drawerOpen={drawerOpen}
        onExpand={() => setCollapsed(false)}
        onToggle={toggleSidebar}
      />
      {isNarrow && drawerOpen && <div className="drawer-backdrop no-print" onClick={() => setDrawerOpen(false)} />}
      <div className="app-main">
        <Header role={user.role} showMenuButton={isNarrow} menuOpen={drawerOpen} onToggleSidebar={toggleSidebar} />
        <main className="app-content">
          {/* Lazy pages load inside the layout so sidebar/header never flash. Lỗi trang chỉ thay vùng nội dung, đổi route thì tự xóa. */}
          <ErrorBoundary resetKey={pathname} wrap>
            <Suspense
              fallback={
                <div className="page">
                  <LoadingState />
                </div>
              }
            >
              <AreaGate path={pathname}>
                <Outlet />
              </AreaGate>
            </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </div>
  );
}
