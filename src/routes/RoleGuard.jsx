import { useAuth } from '@/contexts/AuthContext';
import { StatusPage } from '@/components/ui/StatusPage';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { areaAccess } from '@/utils/school-config/schoolConfigPermissions';

const DEFAULT_DESCRIPTION = 'Chức năng này chỉ dành cho Phó hiệu trưởng. Giáo viên / nhân viên chỉ xử lý phiếu được phân công cho mình.';

/** Renders children only for allowed roles, or when `allow(user)` says so (permission-driven pages). */
export function RoleGuard({ roles = [], allow, children, description = DEFAULT_DESCRIPTION }) {
  const { user } = useAuth();
  if (allow ? allow(user) : roles.includes(user.role)) return children;
  return (
    <div className="page">
      {/* Breadcrumb đặt tiêu đề tab; thiếu thì tab giữ tên trang trước */}
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Không có quyền truy cập' }]} />
      <StatusPage kind="403" title="Bạn không có quyền truy cập chức năng này" description={description} />
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
