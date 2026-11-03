import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorState } from '@/components/ui/States';
import { AppSplash } from '@/components/ui/AppSplash';
import { StandaloneStatus } from '@/components/ui/StandaloneStatus';
import { ROLE_LABELS } from '@/models/User';

export function ProtectedRoute() {
  const { status, user, sessionError, retrySession, logout } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <AppSplash />;
  if (status === 'unavailable')
    return (
      <StandaloneStatus pageTitle="Chưa kết nối được hệ thống">
        <ErrorState error={sessionError} onRetry={retrySession} />
        <div className="row row--center">
          <Link to="/login">Về trang đăng nhập</Link>
        </div>
      </StandaloneStatus>
    );
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  // ADMIN đăng nhập Web được nhưng chưa có màn riêng (ROLE_LABELS chỉ gồm vai trò có màn hình)
  if (!ROLE_LABELS[user.role])
    return (
      <StandaloneStatus
        kind="403"
        title="Tài khoản chưa có màn hình phù hợp"
        description="Bạn đã đăng nhập thành công. Vui lòng liên hệ nhà trường hoặc dùng tài khoản khác để truy cập trang Web."
        action={
          <button type="button" className="btn btn--primary" onClick={() => logout()}>
            Đăng xuất
          </button>
        }
      />
    );
  return <Outlet key={user.id} />;
}

/** Link người khác gửi: sau đăng nhập quay về đúng trang, giữ cả bộ lọc trên URL. */
export const returnPath = (from) => (from?.pathname ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '/');

export function GuestRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <AppSplash />;
  if (status === 'authenticated') return <Navigate to={returnPath(location.state?.from)} replace />;
  return children;
}
