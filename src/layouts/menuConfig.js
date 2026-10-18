import {
  House,
  Baby,
  CalendarDots,
  Buildings,
  ForkKnife,
  ChefHat,
  Gear,
  Bell,
  BookOpenText,
  ClipboardText,
  Star,
  ListChecks,
  Users,
} from '@/components/ui/icons';
import { ROLES } from '@/models/User';

/*
 * Sidebar menu – single source of truth.
 * - Every entry is declared ONCE (label, icon, route) in ITEMS / GROUPS, so a feature has the
 *   same name, icon and position for every role.
 * - MENUS only lists which entries each role sees, in display order (SRS 4.4 Permission Matrix).
 * Add a feature: add it to ITEMS, then put its key in the groups of the roles that use it.
 */

/** Top-level links. */
const LINKS = {
  home: { label: 'Trang chủ', icon: House, to: '/' },
  approvals: { label: 'Chờ duyệt', icon: ListChecks, to: '/approvals' },
  notifications: { label: 'Thông báo', icon: Bell, to: '/notifications' },
};

/** Groups: same label + icon for every role. */
const GROUPS = {
  school: { label: 'Cấu hình trường', icon: CalendarDots },
  people: { label: 'Con người', icon: Users },
  children: { label: 'Quản lý trẻ', icon: Baby },
  attendance: { label: 'Điểm danh & suất ăn', icon: ClipboardText },
  education: { label: 'Kế hoạch giáo dục', icon: BookOpenText },
  assessment: { label: 'Đánh giá trẻ', icon: Star },
  menu: { label: 'Thực đơn', icon: ForkKnife },
  kitchen: { label: 'Bếp & kho', icon: ChefHat },
  facility: { label: 'Cơ sở vật chất', icon: Buildings },
  system: { label: 'Hệ thống', icon: Gear },
};

/** Sub-menu items. */
const ITEMS = {
  schoolYears: { label: 'Năm học', to: '/school/years' },
  schoolClasses: { label: 'Nhóm tuổi & lớp', to: '/school/classes' },
  schoolCutoff: { label: 'Giờ chốt điểm danh', to: '/school/cutoff' },
  schoolCampuses: { label: 'Điểm trường', to: '/school/campuses' },
  schoolVps: { label: 'Phân công Phó hiệu trưởng', to: '/school/vice-principals' },
  schoolTeachers: { label: 'Phân công giáo viên', to: '/school/teachers' },
  // permission: mục chỉ hiện khi /accounts/me có một trong các quyền này (BE ADR-0017)
  peopleHub: { label: 'Nhân sự, phụ huynh & trẻ', to: '/people' },
  permissions: { label: 'Phân quyền', to: '/permissions', permission: 'PERMISSION_MANAGE' },

  childList: { label: 'Danh sách trẻ', to: '/children' },
  childEnroll: { label: 'Tiếp nhận trẻ', to: '/children/new' },
  childPlacement: { label: 'Xếp lớp', to: '/children/placement' },
  parentActivation: { label: 'Tài khoản phụ huynh', to: '/children/activation', permission: 'PARENT_ACCOUNT_MANAGE' },
  healthTrends: { label: 'Xu hướng sức khỏe', to: '/children/health-trends' },

  attendance: { label: 'Điểm danh & báo ăn', to: '/attendance' },
  attendanceSummary: { label: 'Tổng hợp điểm danh', to: '/attendance/summary' },
  mealCount: { label: 'Xác nhận sĩ số suất ăn', to: '/attendance/meal-count' },
  pickup: { label: 'Đón trẻ', to: '/pickup' },

  eduSchool: { label: 'Kế hoạch toàn trường', to: '/education/school' },
  eduGoals: { label: 'Mục tiêu năm học', to: '/education/goals' },
  eduThemes: { label: 'Kế hoạch chủ đề', to: '/education/themes' },
  eduOverview: { label: 'Mục tiêu & chủ đề', to: '/education/overview' },
  eduLessons: { label: 'Giáo án của lớp', to: '/education/lessons' },
  eduReviews: { label: 'Duyệt giáo án', to: '/education/reviews' },
  eduApprovals: { label: 'Phê duyệt kế hoạch', to: '/education/approvals' },

  assessDaily: { label: 'Đánh giá hằng ngày', to: '/assessment/daily' },
  assessProfiles: { label: 'Hồ sơ phát triển', to: '/assessment/children' },
  assessProgress: { label: 'Tiến độ phát triển', to: '/assessment/children' },
  assessPeriodic: { label: 'Đánh giá tuần / tháng', to: '/assessment/periodic' },
  assessYearEnd: { label: 'Đánh giá cuối năm', to: '/assessment/year-end' },
  assessTickets: { label: 'Phiếu bé ngoan', to: '/assessment/tickets' },
  assessRewards: { label: 'Đề xuất khen thưởng', to: '/assessment/rewards' },

  menuFlow: { label: 'Quy trình', to: '/menu/flow' },
  nutritionSetup: { label: 'Thiết lập dinh dưỡng', to: '/menu/setup' },
  foods: { label: 'Thực phẩm', to: '/menu/foods' },
  dishes: { label: 'Món ăn', to: '/menu/dishes' },
  menus: { label: 'Thực đơn mẫu', to: '/menu/menus' },
  weeklyMenus: { label: 'Thực đơn tuần', to: '/menu/weekly' },

  kitchenDay: { label: 'Quy trình bếp hôm nay', to: '/kitchen' },
  publishedMenu: { label: 'Thực đơn đã công bố', to: '/kitchen/published-menu' },
  confirmedMealCount: { label: 'Số suất ăn đã xác nhận', to: '/kitchen/meal-count' },
  forecast: { label: 'Dự trù & đi chợ', to: '/kitchen/forecast' },
  freshReceipts: { label: 'Kiểm nhận hàng tươi', to: '/kitchen/fresh-receipts' },
  foodSamples: { label: 'Sổ lưu mẫu', to: '/kitchen/food-samples' },
  dryStock: { label: 'Kho khô', to: '/kitchen/dry-stock' },
  stockCounts: { label: 'Kiểm kê', to: '/kitchen/stock-counts' },
  stockIssues: { label: 'Phiếu xuất kho', to: '/kitchen/stock-issues' },

  assets: { label: 'Danh sách tài sản', to: '/facility/assets' },
  myFacilityReports: { label: 'Báo sự cố & đề nghị', to: '/facility/my-reports' },
  issues: { label: 'Báo cáo sự cố', to: '/facility/issues' },
  requests: { label: 'Đề nghị bổ sung', to: '/facility/requests' },
  proposals: { label: 'Đề xuất mua sắm, sửa chữa', to: '/facility/proposals' },
  transfers: { label: 'Luân chuyển tài sản', to: '/facility/transfers' },
  inspections: { label: 'Kiểm kê tài sản', to: '/facility/inspections' },

  profile: { label: 'Hồ sơ cá nhân', to: '/account/profile' },
  password: { label: 'Đổi mật khẩu', to: '/account/password' },
};

const link = (key) => ({ ...LINKS[key], key });
const group = (key, itemKeys) => ({ ...GROUPS[key], key, children: itemKeys.map((k) => ({ ...ITEMS[k], key: k })) });
const account = group('system', ['profile', 'password']);

const MENUS = {
  [ROLES.PRINCIPAL]: [
    link('home'),
    link('approvals'),
    group('school', ['schoolYears', 'schoolClasses', 'schoolCutoff', 'schoolCampuses']),
    group('people', ['peopleHub', 'permissions']),
    group('children', ['healthTrends']),
    group('attendance', ['attendanceSummary', 'mealCount']),
    group('assessment', ['assessProgress', 'assessPeriodic', 'assessYearEnd', 'assessRewards']),
    group('education', ['eduSchool']),
    group('menu', ['nutritionSetup', 'weeklyMenus']),
    group('kitchen', [
      'kitchenDay',
      'confirmedMealCount',
      'forecast',
      'freshReceipts',
      'stockIssues',
      'foodSamples',
      'dryStock',
      'stockCounts',
      'publishedMenu',
    ]),
    group('facility', ['assets', 'issues', 'requests', 'proposals', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
  [ROLES.VICE_PRINCIPAL]: [
    link('home'),
    link('approvals'),
    group('school', ['schoolYears', 'schoolClasses', 'schoolCampuses']),
    group('people', ['peopleHub']),
    group('children', ['childEnroll', 'childPlacement', 'healthTrends']),
    group('attendance', ['attendanceSummary', 'mealCount']),
    group('education', ['eduGoals', 'eduApprovals']),
    group('assessment', ['assessProgress', 'assessPeriodic', 'assessYearEnd', 'assessRewards']),
    // Thứ tự theo các bước của trang Quy trình
    group('menu', ['menuFlow', 'nutritionSetup', 'foods', 'dishes', 'menus', 'weeklyMenus']),
    // Thứ tự theo các mốc của trang Quy trình bếp hôm nay
    group('kitchen', [
      'kitchenDay',
      'confirmedMealCount',
      'forecast',
      'freshReceipts',
      'stockIssues',
      'foodSamples',
      'dryStock',
      'stockCounts',
      'publishedMenu',
    ]),
    group('facility', ['assets', 'issues', 'requests', 'proposals', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
  [ROLES.TEAM_LEADER]: [
    link('home'),
    link('approvals'),
    group('children', ['childList', 'healthTrends']),
    group('attendance', ['attendance', 'attendanceSummary', 'pickup']),
    group('education', ['eduGoals', 'eduThemes', 'eduReviews', 'eduOverview', 'eduLessons']),
    group('assessment', ['assessDaily', 'assessProfiles', 'assessPeriodic', 'assessYearEnd', 'assessTickets', 'assessRewards']),
    group('facility', ['assets', 'myFacilityReports', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
  [ROLES.TEACHER]: [
    link('home'),
    group('children', ['childList', 'healthTrends']),
    group('attendance', ['attendance', 'attendanceSummary', 'pickup']),
    group('education', ['eduOverview', 'eduLessons']),
    group('assessment', ['assessDaily', 'assessProfiles', 'assessPeriodic', 'assessYearEnd', 'assessTickets', 'assessRewards']),
    group('facility', ['assets', 'myFacilityReports', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
  [ROLES.KITCHEN_STAFF]: [
    link('home'),
    group('kitchen', ['kitchenDay', 'confirmedMealCount', 'forecast', 'freshReceipts', 'stockIssues', 'foodSamples', 'publishedMenu']),
    group('facility', ['assets', 'myFacilityReports', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
};

// permission: một mã hoặc danh sách (có một trong số đó là đủ)
const allowed = (entry, can) => !entry.permission || [].concat(entry.permission).some((code) => can(code));

/** Menu of a role; items that need a permission are dropped when `can(permission)` is false. */
export const getMenuForRole = (role, can = () => true) =>
  (MENUS[role] || [link('home'), account, link('notifications')])
    .filter((entry) => allowed(entry, can))
    .map((entry) => (entry.children ? { ...entry, children: entry.children.filter((c) => allowed(c, can)) } : entry))
    .filter((entry) => !entry.children || entry.children.length > 0);
