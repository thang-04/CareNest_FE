import { Link } from 'react-router-dom';
import { ShieldAlert } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/ui/States';
import { areaAccess } from '@/utils/school-config/schoolConfigPermissions';

const DEFAULT_DESCRIPTION = 'Chức năng này chỉ dành cho Phó hiệu trưởng. Giáo viên / nhân viên chỉ xử lý phiếu được phân công cho mình.';

/** Renders children only for allowed roles, or when `allow(user)` says so (permission-driven pages). */
export function RoleGuard({ roles = [], allow, children, description = DEFAULT_DESCRIPTION }) {
  const { user } = useAuth();
  if (allow ? allow(user) : roles.includes(user.role)) return children;
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

/** Đường dẫn theo mảng phụ trách của Phó hiệu trưởng: mảng "Không có" thì chặn cả nhóm route. */
const AREA_PREFIXES = [
  ['/menu', 'menu'],
  ['/facility', 'facility'],
  ['/children', 'children'],
  ['/school/rooms', 'rooms'],
  ['/school/staff', 'staff'],
];

export function AreaGate({ path, children }) {
  const { user } = useAuth();
  const hit = AREA_PREFIXES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  if (!hit || user?.role !== 'VICE_PRINCIPAL' || areaAccess(user, hit[1]).access !== 'NONE') return children;
  return (
    <RoleGuard roles={[]} description="Hiệu trưởng chưa giao cho bạn mảng này (Phân công Phó hiệu trưởng).">
      {children}
    </RoleGuard>
  );
}
