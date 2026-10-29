import {
  House,
  Baby,
  CalendarDots,
  Buildings,
  ForkKnife,
  ChefHat,
  Carrot,
  Boxes,
  Gear,
  Bell,
  BookOpenText,
  ClipboardText,
  Star,
  ListChecks,
} from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { FACILITY_ENABLED } from '@/config/app';
import { areaAccess, canOpenTeacherAssignment } from '@/utils/school-config/schoolConfigPermissions';

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
  children: { label: 'Quản lý trẻ', icon: Baby },
  attendance: { label: 'Điểm danh & suất ăn', icon: ClipboardText },
  education: { label: 'Kế hoạch giáo dục', icon: BookOpenText },
  assessment: { label: 'Đánh giá trẻ', icon: Star },
  // Bốn nhóm dinh dưỡng – kho theo luồng BA (docs/features/nutrition-inventory.md)
  catalog: { label: 'Danh mục thực phẩm', icon: Carrot },
  nutrition: { label: 'Dinh dưỡng', icon: ForkKnife },
  stock: { label: 'Kho thực phẩm', icon: Boxes },
  foodReport: { label: 'Báo cáo bếp', icon: ChefHat },
  facility: { label: 'Cơ sở vật chất', icon: Buildings },
  system: { label: 'Hệ thống', icon: Gear },
};

/** Sub-menu items. */
const ITEMS = {
  schoolYears: { label: 'Năm học', to: '/school/years' },
  schoolPlacement: { label: 'Xếp lớp năm học mới', to: '/school/placement' },
  schoolClasses: { label: 'Nhóm tuổi & lớp', to: '/school/classes' },
  schoolRooms: { label: 'Phòng ban', to: '/school/rooms' },
  schoolStaff: { label: 'Tài khoản nhân sự', to: '/school/staff' },
  schoolStaffView: { label: 'Nhân sự điểm trường', to: '/school/staff' },
  schoolCutoff: { label: 'Giờ chốt điểm danh', to: '/school/cutoff' },
  schoolCampuses: { label: 'Điểm trường', to: '/school/campuses' },
  schoolVps: { label: 'Phân công Phó hiệu trưởng', to: '/school/vice-principals' },
  schoolTeachers: { label: 'Phân công giáo viên', to: '/school/teachers' },
  schoolRoles: { label: 'Vai trò & quyền', to: '/school/roles' },

  childList: { label: 'Danh sách trẻ', to: '/children' },
  childEnroll: { label: 'Tiếp nhận trẻ', to: '/children/new' },
  childPlacement: { label: 'Xếp lớp', to: '/children/placement' },
  parentActivation: { label: 'Tài khoản phụ huynh', to: '/children/activation' },
  healthChecks: { label: 'Đợt khám sức khỏe', to: '/children/health-checks' },
  healthFollowUps: { label: 'Phiếu theo dõi sức khỏe', to: '/children/health-follow-ups' },
  healthTrends: { label: 'Xu hướng sức khỏe', to: '/children/health-trends' },

  attendance: { label: 'Điểm danh & báo ăn', to: '/attendance' },
  attendanceSummary: { label: 'Tổng hợp điểm danh', to: '/attendance/summary' },
  attendanceDayUnlocks: { label: 'Mở lại điểm danh', to: '/attendance/day-unlocks' },
  mealCount: { label: 'Sổ báo ăn', to: '/attendance/meal-count' },
  dailyHealthOverview: { label: 'Sức khỏe trong ngày', to: '/attendance/health' },
  pickup: { label: 'Đón trẻ', to: '/pickup' },

  eduSchool: { label: 'Kế hoạch toàn trường', to: '/education/school' },
  eduGoals: { label: 'Mục tiêu năm học', to: '/education/goals' },
  eduBranch: { label: 'Chủ đề nhánh', to: '/education/branches' },
  eduClass: { label: 'Kế hoạch chủ đề', to: '/education/class' },
  eduPlanReviews: { label: 'Duyệt kế hoạch, giáo án', to: '/education/plan-reviews' },
  eduSettings: { label: 'Cấu hình kế hoạch', to: '/education/settings' },
  eduCurriculum: { label: 'Nguồn chương trình của Bộ', to: '/education/curriculum-sources' },

  assessDaily: { label: 'Đánh giá hằng ngày', to: '/assessment/daily' },
  assessDayUnlocks: { label: 'Mở lại ngày đánh giá', to: '/assessment/day-unlocks' },
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
  mealPrices: { label: 'Giá suất ăn', to: '/menu/prices' },
  menus: { label: 'Thực đơn mẫu (ngày)', to: '/menu/menus' },
  weeklyMenus: { label: 'Thực đơn tuần', to: '/menu/weekly' },
  nutrition: { label: 'Cân đối khẩu phần', to: '/menu/nutrition' },
  publishedMenu: { label: 'Thực đơn đã công bố', to: '/kitchen/published-menu' },
  confirmedMealCount: { label: 'Sổ báo ăn', to: '/kitchen/meal-count' },

  // `exact`: /kitchen là tiền tố của mọi trang kho, chỉ sáng khi đúng trang quy trình
  kitchenDay: { label: 'Quy trình bếp hôm nay', to: '/kitchen', exact: true },
  stockReceipts: { label: 'Nhập kho', to: '/kitchen/stock-receipts' },
  suppliers: { label: 'Nhà cung cấp', to: '/kitchen/suppliers' },
  dryStock: { label: 'Tồn kho', to: '/kitchen/dry-stock' },
  stockIssues: { label: 'Xuất kho', to: '/kitchen/stock-issues' },
  freshReceipts: { label: 'Hàng tươi', to: '/kitchen/fresh-receipts' },
  foodSamples: { label: 'Lưu mẫu thực phẩm', to: '/kitchen/food-samples' },
  forecast: { label: 'Dự trù thực phẩm', to: '/kitchen/forecast' },

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
    group('school', [
      'schoolYears',
      'schoolPlacement',
      'schoolClasses',
      'schoolRooms',
      'schoolCutoff',
      'schoolCampuses',
      'schoolStaff',
      'schoolVps',
      'schoolRoles',
    ]),
    group('children', ['childList', 'healthChecks', 'healthFollowUps', 'healthTrends']),
    group('attendance', ['attendanceSummary', 'mealCount', 'attendanceDayUnlocks', 'dailyHealthOverview']),
    group('assessment', ['assessProgress', 'assessPeriodic', 'assessYearEnd', 'assessTickets', 'assessRewards', 'assessDayUnlocks']),
    group('education', ['eduSchool', 'eduPlanReviews', 'eduSettings', 'eduCurriculum']),
    group('catalog', ['suppliers']),
    group('nutrition', ['nutritionSetup', 'weeklyMenus', 'publishedMenu']),
    group('stock', ['dryStock', 'stockIssues', 'freshReceipts']),
    group('foodReport', ['foodSamples', 'forecast']),
    group('facility', ['assets', 'issues', 'requests', 'proposals', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
  [ROLES.VICE_PRINCIPAL]: [
    link('home'),
    link('approvals'),
    group('school', [
      'schoolYears',
      'schoolPlacement',
      'schoolClasses',
      'schoolRooms',
      'schoolCampuses',
      'schoolTeachers',
      'schoolStaffView',
    ]),
    group('children', [
      'childList',
      'childEnroll',
      'childPlacement',
      'parentActivation',
      'healthChecks',
      'healthFollowUps',
      'healthTrends',
    ]),
    group('attendance', ['attendanceSummary', 'mealCount', 'attendanceDayUnlocks', 'dailyHealthOverview']),
    group('education', ['eduGoals', 'eduPlanReviews', 'eduSettings', 'eduCurriculum']),
    group('assessment', ['assessProgress', 'assessPeriodic', 'assessYearEnd', 'assessTickets', 'assessRewards', 'assessDayUnlocks']),
    group('catalog', ['foods', 'dishes']),
    group('nutrition', ['menuFlow', 'nutritionSetup', 'menus', 'weeklyMenus', 'nutrition']),
    group('stock', ['kitchenDay', 'stockReceipts', 'suppliers', 'dryStock', 'stockIssues', 'freshReceipts']),
    group('foodReport', ['foodSamples', 'forecast']),
    group('facility', ['assets', 'issues', 'requests', 'proposals', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
  [ROLES.TEAM_LEADER]: [
    link('home'),
    link('approvals'),
    group('children', ['childList', 'healthChecks', 'healthFollowUps', 'healthTrends']),
    group('attendance', ['attendance', 'attendanceSummary', 'pickup']),
    group('education', ['eduGoals', 'eduBranch', 'eduClass', 'eduPlanReviews', 'eduCurriculum']),
    group('assessment', ['assessDaily', 'assessProfiles', 'assessPeriodic', 'assessYearEnd', 'assessTickets', 'assessRewards']),
    group('facility', ['assets', 'myFacilityReports', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
  [ROLES.TEACHER]: [
    link('home'),
    group('children', ['childList', 'healthChecks', 'healthFollowUps', 'healthTrends']),
    group('attendance', ['attendance', 'attendanceSummary', 'pickup']),
    group('education', ['eduGoals', 'eduBranch', 'eduClass', 'eduCurriculum']),
    group('assessment', ['assessDaily', 'assessProfiles', 'assessPeriodic', 'assessYearEnd', 'assessTickets', 'assessRewards']),
    group('facility', ['assets', 'myFacilityReports', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
  [ROLES.KITCHEN_STAFF]: [
    link('home'),
    group('nutrition', ['publishedMenu', 'confirmedMealCount']),
    group('stock', ['kitchenDay', 'stockIssues', 'freshReceipts']),
    group('foodReport', ['foodSamples', 'forecast']),
    group('facility', ['assets', 'myFacilityReports', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
};

/** "Phân công giáo viên" follows the permission of the Role & Permission screen; every other item stays role-based. */
const withTeacherAssignment = (menu, user) => {
  const allowed = canOpenTeacherAssignment(user);
  const items = menu.map((e) => (e.children ? { ...e, children: e.children.filter((c) => c.key !== 'schoolTeachers') } : e));
  if (!allowed) return items;
  const entry = { ...ITEMS.schoolTeachers, key: 'schoolTeachers' };
  const school = items.find((e) => e.key === 'school');
  if (school) return items.map((e) => (e === school ? { ...e, children: [...e.children, entry] } : e));
  return [items[0], ...items.slice(1, 2), { ...GROUPS.school, key: 'school', children: [entry] }, ...items.slice(2)];
};

/** Mảng chưa được thêm cho Phó hiệu trưởng (Không có): ẩn nhóm / mục menu tương ứng. */
const AREA_GROUPS = { menu: ['catalog', 'nutrition'], facility: ['facility'], children: ['children'] };
const AREA_ITEMS = { rooms: ['schoolRooms'], staff: ['schoolStaffView'], yearPlacement: ['schoolPlacement'] };
const withVpAreas = (menu, user) => {
  if (user?.role !== 'VICE_PRINCIPAL') return menu;
  const none = (area) => areaAccess(user, area).access === 'NONE';
  const hidden = Object.entries(AREA_GROUPS)
    .filter(([area]) => none(area))
    .flatMap(([, groups]) => groups);
  const hiddenItems = Object.entries(AREA_ITEMS)
    .filter(([area]) => none(area))
    .flatMap(([, items]) => items);
  // Mục tạo mới cần đúng quyền Thêm của mảng
  const kids = areaAccess(user, 'children').actions || {};
  if (!kids.create) hiddenItems.push('childEnroll');
  if (!kids.update) hiddenItems.push('childPlacement', 'parentActivation');
  return menu
    .filter((e) => !hidden.includes(e.key))
    .map((e) => (e.children ? { ...e, children: e.children.filter((c) => !hiddenItems.includes(c.key)) } : e));
};

const withFacility = (menu) => (FACILITY_ENABLED ? menu : menu.filter((e) => e.key !== 'facility'));

export const getMenuForRole = (role, user) =>
  withFacility(withVpAreas(withTeacherAssignment(MENUS[role] || [link('home'), account, link('notifications')], user), user));
