import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { StandaloneStatus } from '@/components/ui/StandaloneStatus';
import { ROLE_LABELS } from '@/models/User';
import { areaAccess } from '@/utils/school-config/schoolConfigPermissions';
import { isVpReadOnlyPage } from '@/utils/account/vpReadOnlyPages';
import '@/styles/modules/permissions.css';
const DEFAULT_DESCRIPTION = 'Chức năng này chỉ dành cho Phó hiệu trưởng. Giáo viên / nhân viên chỉ xử lý phiếu được phân công cho mình.';

/** Renders children only for allowed roles, or when `allow(user)` says so (permission-driven pages). */
export function RoleGuard({ roles = [], allow, children, description = DEFAULT_DESCRIPTION }) {
  const { user } = useAuth();
  if (allow ? allow(user) : roles.includes(user.role)) return children;
  return <AccessDenied title="Bạn không có quyền truy cập chức năng này" description={description} />;
}

/**
 * 403/404 theo URL (thường là link người khác gửi): toàn màn hình, không vỏ app của vai trò không có màn đó.
 * Nói rõ đang đăng nhập bằng ai và cho đổi tài khoản; đăng nhập lại sẽ quay về đúng link (ProtectedRoute giữ `from`).
 */
export function AccessDenied({ kind = '403', title, description }) {
  const { user, logout } = useAuth();
  return (
    <StandaloneStatus
      kind={kind}
      title={title}
      description={description}
      note={
        user && (
          <>
            Bạn đang đăng nhập bằng tài khoản <strong>{user.fullName}</strong>
            {ROLE_LABELS[user.role] && ` (${ROLE_LABELS[user.role]})`}.
          </>
        )
      }
      action={
        <div className="row row--center">
          <Link className="btn btn--primary" to="/">
            Về trang chủ
          </Link>
          <button type="button" className="btn" onClick={() => logout()}>
            Đăng nhập tài khoản khác
          </button>
        </div>
      }
    />
  );
}

/** Đường dẫn theo mảng phụ trách của Phó hiệu trưởng: mảng "Không có" thì chặn cả nhóm route. */
const AREA_PREFIXES = [
  ['/menu', 'menu'],
  ['/children', 'children'],
  ['/school/rooms', 'rooms'],
  ['/school/staff', 'staff'],
];
export function AreaGate({ path, children }) {
  const { user } = useAuth();
  const hit = AREA_PREFIXES.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  if (!hit || user?.role !== 'VICE_PRINCIPAL' || areaAccess(user, hit[1]).access !== 'NONE') {
    if (!isVpReadOnlyPage(user, path)) return children;
    return (
      <>
        <div className="alert alert--info page-readonly-notice" role="status">
          Bạn đang chỉ xem mục này. Muốn sửa, hãy nhờ Hiệu trưởng giao việc ở màn Phân công Phó hiệu trưởng.
        </div>
        {children}
      </>
    );
  }
  return (
    <RoleGuard roles={[]} description="Hiệu trưởng chưa giao cho bạn mảng này (Phân công Phó hiệu trưởng).">
      {children}
    </RoleGuard>
  );
}
