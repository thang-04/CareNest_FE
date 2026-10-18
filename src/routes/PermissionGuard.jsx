import { Link } from 'react-router-dom';
import { ShieldAlert } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/ui/States';

const DEFAULT_DESCRIPTION = 'Tài khoản của bạn chưa được cấp quyền dùng chức năng này. Liên hệ Hiệu trưởng nếu cần.';

/** Renders children only when the user has one of the permissions returned by BE (/accounts/me). */
export function PermissionGuard({ permissions, children, description = DEFAULT_DESCRIPTION }) {
  const { hasPermission } = useAuth();
  if (hasPermission(...permissions)) return children;
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
