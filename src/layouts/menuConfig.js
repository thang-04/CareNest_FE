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
} from '@/components/ui/icons';
import { ROLES } from '@/models/User';
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
  menu: { label: 'Thực đơn', icon: ForkKnife },
  kitchen: { label: 'Bếp & kho', icon: ChefHat },
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
  mealCount: { label: 'Xác nhận sĩ số suất ăn', to: '/attendance/meal-count' },
  mealHandover: { label: 'Bàn giao suất ăn', to: '/attendance/meal-handover' },
  dailyHealthOverview: { label: 'Sức khỏe đầu ngày', to: '/attendance/health' },
  pickup: { label: 'Đón trẻ', to: '/pickup' },

  eduSchool: { label: 'Kế hoạch toàn trường', to: '/education/school' },
  eduGoals: { label: 'Mục tiêu năm học', to: '/education/goals' },
  eduBranch: { label: 'Chủ đề nhánh', to: '/education/branches' },
  eduClass: { label: 'Kế hoạch chủ đề', to: '/education/class' },
  eduPlanReviews: { label: 'Duyệt kế hoạch, giáo án', to: '/education/plan-reviews' },
  eduSettings: { label: 'Cấu hình kế hoạch', to: '/education/settings' },

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
  menus: { label: 'Thực đơn mẫu', to: '/menu/menus' },
  allergyMenus: { label: 'Thực đơn thay thế', to: '/menu/allergy-menus' },
  weeklyMenus: { label: 'Thực đơn tuần', to: '/menu/weekly' },
  aiMenu: { label: 'Gợi ý thực đơn AI', to: '/menu/ai-suggestion' },
  nutrition: { label: 'Cân đối dinh dưỡng', to: '/menu/nutrition' },
  menuPlans: { label: 'Kế hoạch thực đơn', to: '/menu/plans' },

  publishedMenu: { label: 'Thực đơn đã công bố', to: '/kitchen/published-menu' },
  confirmedMealCount: { label: 'Số suất ăn đã xác nhận', to: '/kitchen/meal-count' },
  requiredQuantity: { label: 'Định lượng thực phẩm', to: '/kitchen/required-quantity' },
  ingredientReceipts: { label: 'Nhận thực phẩm từ kho', to: '/kitchen/ingredient-receipts' },
  missingFood: { label: 'Báo thiếu thực phẩm', to: '/kitchen/missing-food' },
  preparationUpdate: { label: 'Cập nhật chế biến', to: '/kitchen/preparation/update' },
  stockReceipts: { label: 'Nhập kho thực phẩm', to: '/kitchen/stock-receipts' },
  stockIssues: { label: 'Duyệt xuất kho', to: '/kitchen/stock-issues' },
  preparation: { label: 'Tình trạng chế biến', to: '/kitchen/preparation' },

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
    group('assessment', ['assessProgress', 'assessPeriodic', 'assessYearEnd', 'assessRewards', 'assessDayUnlocks']),
    group('education', ['eduSchool', 'eduPlanReviews', 'eduSettings']),
    group('menu', ['nutritionSetup', 'weeklyMenus']),
    group('kitchen', ['publishedMenu', 'confirmedMealCount']),
    group('facility', ['assets', 'issues', 'requests', 'proposals', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
  [ROLES.VICE_PRINCIPAL]: [
    link('home'),
    link('approvals'),
    group('school', ['schoolYears', 'schoolClasses', 'schoolRooms', 'schoolCampuses', 'schoolTeachers', 'schoolStaffView']),
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
    group('education', ['eduGoals', 'eduPlanReviews', 'eduSettings']),
    group('assessment', ['assessProgress', 'assessPeriodic', 'assessYearEnd', 'assessRewards', 'assessDayUnlocks']),
    group('menu', ['menuFlow', 'nutritionSetup', 'foods', 'dishes', 'menus', 'weeklyMenus']),
    group('kitchen', [
      'stockReceipts',
      'stockIssues',
      'preparation',
      'publishedMenu',
      'confirmedMealCount',
      'requiredQuantity',
      'ingredientReceipts',
      'missingFood',
    ]),
    group('facility', ['assets', 'issues', 'requests', 'proposals', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
  [ROLES.TEAM_LEADER]: [
    link('home'),
    link('approvals'),
    group('children', ['childList', 'healthChecks', 'healthFollowUps', 'healthTrends']),
    group('attendance', ['attendance', 'attendanceSummary', 'mealHandover', 'pickup']),
    group('education', ['eduGoals', 'eduBranch', 'eduClass', 'eduPlanReviews']),
    group('assessment', ['assessDaily', 'assessProfiles', 'assessPeriodic', 'assessYearEnd', 'assessTickets', 'assessRewards']),
    group('facility', ['assets', 'myFacilityReports', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
  [ROLES.TEACHER]: [
    link('home'),
    group('children', ['childList', 'healthChecks', 'healthFollowUps', 'healthTrends']),
    group('attendance', ['attendance', 'attendanceSummary', 'pickup']),
    group('education', ['eduGoals', 'eduBranch', 'eduClass']),
    group('assessment', ['assessDaily', 'assessProfiles', 'assessPeriodic', 'assessYearEnd', 'assessTickets', 'assessRewards']),
    group('facility', ['assets', 'myFacilityReports', 'transfers', 'inspections']),
    account,
    link('notifications'),
  ],
  [ROLES.KITCHEN_STAFF]: [
    link('home'),
    group('kitchen', ['publishedMenu', 'confirmedMealCount', 'requiredQuantity', 'ingredientReceipts', 'missingFood', 'preparationUpdate']),
    group('attendance', ['mealHandover']),
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
const AREA_GROUPS = { menu: ['menu'], facility: ['facility'], children: ['children'] };
const AREA_ITEMS = { rooms: ['schoolRooms'], staff: ['schoolStaffView'] };
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

export const getMenuForRole = (role, user) =>
  withVpAreas(withTeacherAssignment(MENUS[role] || [link('home'), account, link('notifications')], user), user);
