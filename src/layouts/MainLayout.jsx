import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { isPageLoading, subscribePageLoading } from '@/routes/routePrefetch';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Footer } from './Footer';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingState } from '@/components/ui/States';
import { AppSplash } from '@/components/ui/AppSplash';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { AreaGate } from '@/routes/RoleGuard';
import { DemoDataBanner } from './DemoDataBanner';
import { useMediaQuery } from '@/hooks';
import { HeaderSlotContext } from '@/contexts/HeaderSlotContext';
import './layout.css';

const COLLAPSED_KEY = 'carenest.sidebar.collapsed';
const NARROW_QUERY = '(max-width: 1023px)';

/** Chạy khi Suspense đã hiện trang thật (chunk tải xong) — đánh dấu hết giai đoạn khởi động. */
function PageShown({ onShown }) {
  useEffect(onShown, [onShown]);
  return null;
}

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
};

// Khu bán trú dùng thẻ nền đặc, không kính: bảng số liệu dày, tranh nền làm khó đọc
const BOARDING_AREA = /^\/(menu|kitchen|boarding)(\/|$)|^\/attendance\/meal-count/;

export function MainLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // Dưới 1024px sidebar thành drawer: ẩn mặc định, mở bằng nút menu
  const isNarrow = useMediaQuery(NARROW_QUERY);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Ô trên thanh trên nhận đường dẫn + tên trang do từng trang đưa lên (Breadcrumb)
  const [crumbSlot, setCrumbSlot] = useState(null);
  const pageShown = useRef(false);
  const markPageShown = useRef(() => {
    pageShown.current = true;
  }).current;

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
  const opening = useSyncExternalStore(subscribePageLoading, isPageLoading);

  return (
    <div className="app-shell" data-area={BOARDING_AREA.test(pathname) ? 'boarding' : undefined}>
      {opening && <div className="route-progress no-print" role="progressbar" aria-label="Đang mở trang" />}
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
        <Header role={user.role} showMenuButton={isNarrow} menuOpen={drawerOpen} onToggleSidebar={toggleSidebar} crumbRef={setCrumbSlot} />
        <HeaderSlotContext.Provider value={crumbSlot}>
          <main className="app-content" aria-busy={opening || undefined}>
            <DemoDataBanner pathname={pathname} />
            {/* Mở app/tải lại tab: splash phủ cả màn tới khi trang đầu có chunk (không lộ vỏ trống). Đổi trang sau đó: chờ giữa vùng nội dung, giữ sidebar.
              Lỗi trang chỉ thay vùng nội dung, đổi route thì tự xóa. */}
            <ErrorBoundary resetKey={pathname} wrap>
              <Suspense
                fallback={
                  pageShown.current ? (
                    <div className="page">
                      <LoadingState />
                    </div>
                  ) : (
                    <AppSplash />
                  )
                }
              >
                <AreaGate path={pathname}>
                  <Outlet />
                </AreaGate>
                <PageShown onShown={markPageShown} />
              </Suspense>
            </ErrorBoundary>
          </main>
        </HeaderSlotContext.Provider>
        <Footer />
      </div>
    </div>
  );
}
