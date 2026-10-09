import { Link } from 'react-router-dom';
import { ShieldAlert } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/ui/States';

const DEFAULT_DESCRIPTION = 'Chức năng này chỉ dành cho Phó hiệu trưởng. Giáo viên / nhân viên chỉ xử lý phiếu được phân công cho mình.';

/** Renders children only for allowed roles. */
export function RoleGuard({ roles, children, description = DEFAULT_DESCRIPTION }) {
  const { user } = useAuth();
  if (roles.includes(user.role)) return children;
  return (
    <div className="page">
      <div className="card mt-24">
        <EmptyState
          icon={ShieldAlert}
          title="Bạn không có quyền truy cập chức năng này"
          description={description}
          action={
            <Link className="btn btn--primary" to="/">
              Về trang chủ
            </Link>
          }
        />
      </div>
    </div>
  );
}
