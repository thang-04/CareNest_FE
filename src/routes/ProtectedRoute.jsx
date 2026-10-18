import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorState, LoadingState } from '@/components/ui/States';

export function ProtectedRoute() {
  const { status, user, sessionError, retrySession, logout } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState text="Đang kiểm tra phiên đăng nhập..." />;
  if (status === 'unavailable')
    return (
      <div className="page">
        <ErrorState error={sessionError} onRetry={retrySession} />
        <Link to="/login">Về trang đăng nhập</Link>
      </div>
    );
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  if (!user.role)
    return (
      <div className="page">
        <div className="card">
          <div className="card__body stack">
            <h1 className="page__title">Tài khoản chưa có màn hình phù hợp</h1>
            <p>Bạn đã đăng nhập thành công. Vui lòng liên hệ nhà trường hoặc dùng tài khoản khác để truy cập trang Web.</p>
            <button type="button" className="btn btn--primary" onClick={() => logout()}>
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    );
  return <Outlet key={user.id} />;
}

export function GuestRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState text="Đang kiểm tra phiên đăng nhập..." />;
  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname || '/'} replace />;
  return children;
}
