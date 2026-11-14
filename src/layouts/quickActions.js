import { Award, Baby, BookOpen, Building2, CalendarDays, CookingPot, PenLine, Target, Truck } from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { areaAccess } from '@/utils/school-config/schoolConfigPermissions';
const R = ROLES;
const VP_ONLY = [R.VICE_PRINCIPAL];
const LEADERS = [R.PRINCIPAL, R.VICE_PRINCIPAL];
const CLASS_STAFF = [R.TEACHER, R.TEAM_LEADER];

/*
 * Nhóm "Tạo nhanh" trong ô tìm chức năng ở header (nút Tạo nhanh riêng đã bỏ): các trang tạo mới, theo thứ tự hay dùng.
 * `roles` chép đúng RoleGuard của route trong AppRoutes.jsx (chỉ để ẩn/hiện; BE vẫn kiểm quyền).
 * Đổi quyền một route thì sửa cả ở đây.
 */
const QUICK_ACTIONS = [
  {
    label: 'Soạn kế hoạch giáo dục ngày',
    to: '/education/day-plans',
    group: 'Kế hoạch giáo dục',
    icon: BookOpen,
    roles: CLASS_STAFF,
  },
  {
    label: 'Đề xuất khen thưởng',
    to: '/assessment/rewards',
    group: 'Đánh giá trẻ',
    icon: Award,
    roles: CLASS_STAFF,
  },
  {
    label: 'Kế hoạch giáo dục chủ đề',
    to: '/education/theme-plans',
    group: 'Kế hoạch giáo dục',
    icon: PenLine,
    roles: [R.TEAM_LEADER],
  },
  {
    label: 'Tiếp nhận trẻ',
    to: '/children/new',
    group: 'Quản lý trẻ',
    icon: Baby,
    roles: LEADERS,
    area: 'children',
  },
  {
    label: 'Thực đơn tuần',
    to: '/menu/weekly',
    group: 'Dinh dưỡng',
    icon: CookingPot,
    roles: VP_ONLY,
    area: 'menu',
  },
  {
    label: 'Phiếu nhập kho',
    to: '/kitchen/stock-receipts/new',
    group: 'Kho thực phẩm',
    icon: Truck,
    roles: VP_ONLY,
  },
  {
    label: 'Kế hoạch giáo dục tổ',
    to: '/education/goals',
    group: 'Kế hoạch giáo dục',
    icon: Target,
    roles: VP_ONLY,
  },
  {
    label: 'Năm học mới',
    to: '/school/years/new',
    group: 'Cấu hình trường',
    icon: CalendarDays,
    roles: [R.PRINCIPAL],
  },
  {
    label: 'Điểm trường',
    to: '/school/campuses/new',
    group: 'Cấu hình trường',
    icon: Building2,
    roles: [R.PRINCIPAL],
  },
];

// PHT: mục tạo mới của một mảng chỉ hiện khi Hiệu trưởng giao quyền Thêm ở mảng đó
export const getQuickActionsForRole = (role, user) =>
  QUICK_ACTIONS.filter(
    (a) => a.roles.includes(role) && (!a.area || role !== R.VICE_PRINCIPAL || !!areaAccess(user, a.area).actions?.create),
  );
