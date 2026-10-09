import {
  ArrowLeftRight,
  AlertTriangle,
  Award,
  Baby,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  CookingPot,
  PackagePlus,
  PenLine,
  Target,
  Truck,
  Wrench,
} from '@/components/ui/icons';
import { ROLES } from '@/models/User';

const R = ROLES;
const VP_ONLY = [R.VICE_PRINCIPAL];
const CLASS_STAFF = [R.TEACHER, R.TEAM_LEADER];
const REPORTERS = [...CLASS_STAFF, R.KITCHEN_STAFF];

/*
 * "Tạo nhanh" ở header: các trang tạo mới, theo thứ tự hay dùng.
 * `roles` chép đúng RoleGuard của route trong AppRoutes.jsx (chỉ để ẩn/hiện; BE vẫn kiểm quyền).
 * Đổi quyền một route thì sửa cả ở đây.
 */
const QUICK_ACTIONS = [
  { label: 'Soạn giáo án', to: '/education/lessons/new', group: 'Kế hoạch giáo dục', icon: BookOpen, roles: CLASS_STAFF },
  { label: 'Báo sự cố CSVC', to: '/facility/issues/new', group: 'Cơ sở vật chất', icon: AlertTriangle, roles: REPORTERS },
  { label: 'Đề nghị bổ sung', to: '/facility/requests/new', group: 'Cơ sở vật chất', icon: PackagePlus, roles: REPORTERS },
  { label: 'Đề xuất khen thưởng', to: '/assessment/rewards/new', group: 'Đánh giá trẻ', icon: Award, roles: CLASS_STAFF },
  { label: 'Kế hoạch chủ đề', to: '/education/themes/new', group: 'Kế hoạch giáo dục', icon: PenLine, roles: [R.TEAM_LEADER] },
  { label: 'Tiếp nhận trẻ', to: '/children/new', group: 'Quản lý trẻ', icon: Baby, roles: VP_ONLY },
  { label: 'Đề xuất mua sắm, sửa chữa', to: '/facility/proposals/new', group: 'Cơ sở vật chất', icon: Wrench, roles: VP_ONLY },
  { label: 'Thực đơn tuần', to: '/menu/weekly/new', group: 'Thực đơn', icon: CookingPot, roles: VP_ONLY },
  { label: 'Phiếu nhập kho', to: '/kitchen/stock-receipts/new', group: 'Bếp & kho', icon: Truck, roles: VP_ONLY },
  { label: 'Bộ mục tiêu năm học', to: '/education/goals/new', group: 'Kế hoạch giáo dục', icon: Target, roles: VP_ONLY },
  { label: 'Phiếu luân chuyển tài sản', to: '/facility/transfers/new', group: 'Cơ sở vật chất', icon: ArrowLeftRight, roles: VP_ONLY },
  { label: 'Đợt kiểm kê', to: '/facility/inspections/new', group: 'Cơ sở vật chất', icon: ClipboardList, roles: VP_ONLY },
  { label: 'Năm học mới', to: '/school/years/new', group: 'Cấu hình trường', icon: CalendarDays, roles: [R.PRINCIPAL] },
  { label: 'Điểm trường', to: '/school/campuses/new', group: 'Cấu hình trường', icon: Building2, roles: [R.PRINCIPAL] },
];

export const getQuickActionsForRole = (role) => QUICK_ACTIONS.filter((a) => a.roles.includes(role));
