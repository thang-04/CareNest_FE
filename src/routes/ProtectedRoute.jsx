import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingState } from '@/components/ui/States';

/** Renders child routes only for a logged-in user; otherwise goes to /login and comes back after. */
export function ProtectedRoute() {
  const { status, user } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState text="Đang kiểm tra phiên đăng nhập..." />;
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  // key: remount pages when another account logs in, so no state leaks between users.
  return <Outlet key={user.id} />;
}

/** Login page: already logged-in users go straight to the app. */
export function GuestRoute({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <LoadingState text="Đang kiểm tra phiên đăng nhập..." />;
  if (status === 'authenticated') return <Navigate to={location.state?.from?.pathname || '/'} replace />;
  return children;
}
