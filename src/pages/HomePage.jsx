import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { ROLES } from '@/models/User';

const DASHBOARDS = {
  [ROLES.PRINCIPAL]: lazy(() => import('@/pages/dashboard/PrincipalDashboard')),
  [ROLES.VICE_PRINCIPAL]: lazy(() => import('@/pages/dashboard/VicePrincipalDashboard')),
  [ROLES.TEAM_LEADER]: lazy(() => import('@/pages/dashboard/TeamLeaderDashboard')),
  [ROLES.TEACHER]: lazy(() => import('@/pages/dashboard/TeacherDashboard')),
  [ROLES.KITCHEN_STAFF]: lazy(() => import('@/pages/dashboard/KitchenDashboard')),
};

/** Home `/`: the dashboard of the signed-in role (SRS screens #10–#14). */
export default function HomePage() {
  const { user } = useAuth();
  // BUG-005: Admin không có trang tổng quan ⇒ vào thẳng màn quản trị tài khoản
  if (user.role === ROLES.ADMIN) return <Navigate to="/school/staff" replace />;
  const Dashboard = DASHBOARDS[user.role];
  if (!Dashboard) {
    return (
      <div className="page">
        <Breadcrumb items={[{ label: 'Trang chủ' }]} />
        <h1 className="page__title">Xin chào, {user.fullName}</h1>
        <EmptyState title="Chưa có trang tổng quan cho vai trò này" description="Dùng menu bên trái để mở chức năng bạn được phân quyền." />
      </div>
    );
  }
  return (
    <Suspense fallback={<LoadingState />}>
      <Dashboard />
    </Suspense>
  );
}
