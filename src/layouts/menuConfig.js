import {
  House,
  Baby,
  CalendarDots,
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
  CalendarCheck,
  ShieldCheck,
} from '@/components/ui/icons';
import { ROLES } from '@/models/User';
import { areaAccess, canOpenTeacherAssignment } from '@/utils/school-config/schoolConfigPermissions';
import { hasBePermission } from '@/utils/account/accountPermissions';
import { PERMISSIONS } from '@/models/account/permissionConstants';
import { USE_MOCK } from '@/config/env';
import { INTEGRATION_MODULES } from '@/config/integrationModules';

/*
 * Sidebar menu – single source of truth.
 * - Every entry is declared ONCE (label, icon, route) in ITEMS / GROUPS, so a feature has the
 *   same name, icon and position for every role.
 * - MENUS only lists which entries each role sees, in display order (SRS 4.4 Permission Matrix).
 * Add a feature: add it to ITEMS, then put its key in the groups of the roles that use it.
 */

/** Top-level links. */
const LINKS = {
  home: {
    label: 'Trang chủ',
    icon: House,
    to: '/',
  },
  approvals: {
    label: 'Chờ duyệt',
    icon: ListChecks,
    to: '/approvals',
  },
  notifications: {
    label: 'Thông báo',
    icon: Bell,
    to: '/notifications',
  },
  // BE meal-management-permissions.md mục 1: "Bán trú hôm nay" là một trang, không có mục con
  boardingToday: {
    label: 'Bán trú hôm nay',
    icon: CalendarCheck,
    to: '/boarding/today',
  },
};

/** Groups: same label + icon for every role. */
const GROUPS = {
  school: {
    label: 'Cấu hình trường',
    icon: CalendarDots,
  },
  children: {
    label: 'Quản lý trẻ',
    icon: Baby,
  },
  attendance: {
    label: 'Điểm danh & suất ăn',
    icon: ClipboardText,
  },
  education: {
    label: 'Kế hoạch giáo dục',
    icon: BookOpenText,
  },
  assessment: {
    label: 'Đánh giá trẻ',
    icon: Star,
  },
  // Nhóm bán trú theo việc của PHT dinh dưỡng (BE docs/business/flows/meal-management-permissions.md mục 1)
  nutrition: {
    label: 'Thực đơn & dinh dưỡng',
    icon: ForkKnife,
  },
  kitchenOps: {
    label: 'Vận hành bếp',
    icon: ChefHat,
  },
  stock: {
    label: 'Kho thực phẩm',
    icon: Boxes,
  },
  foodSafety: {
    label: 'An toàn thực phẩm',
    icon: ShieldCheck,
  },
  catalog: {
    label: 'Danh mục & thiết lập',
    icon: Carrot,
  },
  system: {
    label: 'Hệ thống',
    icon: Gear,
  },
};

// Không import demoSource ở đây: nó kéo mockDatabase (cần window) vào menu
const MENU_TEMPLATE_API = !USE_MOCK && INTEGRATION_MODULES['menu-template']?.source === 'api';

/** Sub-menu items. */
const ITEMS = {
  schoolYears: {
    label: 'Năm học',
    to: '/school/years',
  },
  schoolPlacement: {
    label: 'Xếp lớp năm học mới',
    to: '/school/placement',
  },
  schoolClasses: {
    label: 'Nhóm tuổi & lớp',
    to: '/school/classes',
  },
  schoolRooms: {
    label: 'Phòng ban',
    to: '/school/rooms',
  },
  schoolStaff: {
    label: 'Tài khoản nhân sự',
    to: '/school/staff',
  },
  schoolStaffView: {
    label: 'Nhân sự điểm trường',
    to: '/school/staff',
  },
  schoolCutoff: {
    label: 'Cấu hình thời gian',
    to: '/school/cutoff',
  },
  schoolCampuses: {
    label: 'Điểm trường',
    to: '/school/campuses',
  },
  schoolVps: {
    label: 'Phân công Phó hiệu trưởng',
    to: '/school/vice-principals',
  },
  schoolTeachers: {
    label: 'Phân công giáo viên',
    to: '/school/teachers',
  },
  schoolRoles: {
    label: 'Vai trò & quyền',
    to: '/school/roles',
  },
  childList: {
    label: 'Danh sách trẻ',
    to: '/children',
  },
  childEnroll: {
    label: 'Tiếp nhận trẻ',
    to: '/children/new',
  },
  childPlacement: {
    label: 'Xếp lớp',
    to: '/children/placement',
  },
  parentActivation: {
    label: 'Tài khoản phụ huynh',
    to: '/children/activation',
  },
  healthChecks: {
    label: 'Đợt khám, kỳ cân đo',
    to: '/children/health-checks',
  },
  healthFollowUps: {
    label: 'Phiếu theo dõi sức khỏe',
    to: '/children/health-follow-ups',
  },
  healthTrends: {
    label: 'Xu hướng sức khỏe',
    to: '/children/health-trends',
  },
  attendance: {
    label: 'Điểm danh & báo ăn',
    to: '/attendance',
    // Chỉ sáng ở màn điểm danh, không sáng cùng các màn con /attendance/*
    exact: true,
  },
  attendanceSummary: {
    label: 'Tổng hợp điểm danh',
    to: '/attendance/summary',
  },
  attendanceDayUnlocks: {
    label: 'Mở lại điểm danh',
    to: '/attendance/day-unlocks',
  },
  mealCount: {
    label: 'Sổ suất ăn',
    to: '/attendance/meal-count',
  },
  dailyHealthOverview: {
    label: 'Sức khỏe trong ngày',
    to: '/attendance/health',
  },
  leaveRequests: {
    label: 'Đơn nghỉ của phụ huynh',
    to: '/attendance/leave-requests',
  },
  pickup: {
    label: 'Đón trẻ',
    to: '/pickup',
  },
  eduSchool: {
    label: 'Kế hoạch toàn trường',
    to: '/education/school',
  },
  eduGoals: {
    label: 'Kế hoạch năm học',
    to: '/education/goals',
  },
  eduBranch: {
    label: 'Chủ đề nhánh',
    to: '/education/branches',
  },
  eduClass: {
    label: 'Kế hoạch chủ đề',
    to: '/education/class',
  },
  eduPlanReviews: {
    label: 'Duyệt kế hoạch, giáo án',
    to: '/education/plan-reviews',
  },
  eduSettings: {
    label: 'Cấu hình kế hoạch',
    to: '/education/settings',
  },
  eduCurriculum: {
    label: 'Nguồn chương trình của Bộ',
    to: '/education/curriculum-sources',
  },
  assessDaily: {
    label: 'Đánh giá hằng ngày',
    to: '/assessment/daily',
  },
  assessOverview: {
    label: 'Tổng quan đánh giá lớp',
    to: '/assessment/overview',
  },
  assessQuality: {
    label: 'Chất lượng tháng',
    to: '/assessment/quality-report',
  },
  assessClassRatings: {
    label: 'Xếp loại nhóm lớp',
    to: '/assessment/class-ratings',
  },
  assessThemes: {
    label: 'Đánh giá cuối chủ đề',
    to: '/assessment/themes',
  },
  assessDayUnlocks: {
    label: 'Mở lại ngày đánh giá',
    to: '/assessment/day-unlocks',
  },
  assessProfiles: {
    label: 'Hồ sơ phát triển',
    to: '/assessment/children',
  },
  assessProgress: {
    label: 'Tiến độ phát triển',
    to: '/assessment/children',
  },
  assessSemester: {
    label: 'Đánh giá học kỳ',
    to: '/assessment/semester',
  },
  assessYearEnd: {
    label: 'Đánh giá cuối năm',
    to: '/assessment/year-end',
  },
  assessTickets: {
    label: 'Phiếu bé ngoan',
    to: '/assessment/tickets',
  },
  assessRewards: {
    label: 'Đề xuất khen thưởng',
    to: '/assessment/rewards',
  },
  nutritionSetup: {
    label: 'Cấu hình nhóm tuổi',
    to: '/menu/setup',
  },
  foods: {
    label: 'Thực phẩm',
    to: '/menu/foods',
  },
  dishes: {
    label: 'Món ăn',
    to: '/menu/dishes',
  },
  menus: {
    label: 'Mẫu thực đơn',
    // Bản nối BE: /menu/menus chuyển hướng sang /menu/templates ⇒ trỏ thẳng để mục sáng đúng và breadcrumb khớp
    to: MENU_TEMPLATE_API ? '/menu/templates' : '/menu/menus',
  },
  weeklyMenus: {
    label: 'Kế hoạch tuần & công bố',
    to: '/menu/weekly',
  },
  menuStatistics: {
    label: 'Thống kê định lượng',
    to: '/menu/statistics',
  },
  nutrition: {
    label: 'Cân đối khẩu phần',
    to: '/menu/nutrition',
  },
  publishedMenu: {
    label: 'Thực đơn bếp nhận',
    to: '/kitchen/published-menu',
  },
  mealPhotos: {
    label: 'Ảnh bữa ăn',
    to: '/kitchen/meal-photos',
  },
  stockReceipts: {
    label: 'Phiếu nhập',
    to: '/kitchen/stock-receipts',
  },
  stockHistory: {
    label: 'Lịch sử nhập/trừ',
    to: '/kitchen/stock-history',
  },
  stockShortfalls: {
    label: 'Phần thiếu chờ bổ sung',
    to: '/kitchen/stock-shortfalls',
  },
  suppliers: {
    label: 'Nhà cung cấp',
    to: '/menu/suppliers',
  },
  dryStock: {
    label: 'Tồn kho khô',
    to: '/kitchen/dry-stock',
  },
  freshReceipts: {
    label: 'Kiểm nhận hàng tươi',
    to: '/kitchen/fresh-receipts',
  },
  inspections: {
    label: 'Kiểm thực ba bước',
    to: '/kitchen/inspections',
  },
  foodSamples: {
    label: 'Lưu mẫu thực phẩm',
    to: '/kitchen/food-samples',
  },
  forecast: {
    label: 'Bản dự trù',
    to: '/kitchen/forecast',
  },
  profile: {
    label: 'Hồ sơ cá nhân',
    to: '/account/profile',
  },
  password: {
    label: 'Đổi mật khẩu',
    to: '/account/password',
  },
  signatures: {
    label: 'Chữ ký của tôi',
    to: '/account/signatures',
  },
};
const link = (key) => ({
  ...LINKS[key],
  key,
});
const group = (key, itemKeys) => ({
  ...GROUPS[key],
  key,
  children: itemKeys.map((k) => ({
    ...ITEMS[k],
    key: k,
  })),
});
const account = group('system', ['profile', 'signatures', 'password']);
// Nhãn khu trên sidebar: các mục liền nhau cùng `section` được Sidebar gom dưới một nhãn
const BOARDING_SECTION = 'Bán trú';
// Khu bán trú: "Bán trú hôm nay" đứng đầu, rồi năm nhóm theo thứ tự cố định; nhóm không có mục nào thì bỏ
const boardingSection = ({ nutrition = [], kitchenOps = [], stock = [], foodSafety = [], catalog = [] }) =>
  [
    link('boardingToday'),
    ...[
      ['nutrition', nutrition],
      ['kitchenOps', kitchenOps],
      ['stock', stock],
      ['foodSafety', foodSafety],
      ['catalog', catalog],
    ]
      .filter(([, keys]) => keys.length)
      .map(([key, keys]) => group(key, keys)),
  ].map((entry) => ({ ...entry, section: BOARDING_SECTION }));
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
    // Tiếp nhận trẻ, Xếp lớp như PHT trên mọi điểm trường (user chốt 2026-10-27)
    group('children', ['childList', 'childEnroll', 'childPlacement', 'parentActivation', 'healthChecks', 'healthTrends']),
    group('attendance', ['attendanceSummary', 'leaveRequests', 'attendanceDayUnlocks', 'dailyHealthOverview']),
    group('assessment', [
      'assessOverview',
      'assessQuality',
      'assessClassRatings',
      'assessProgress',
      'assessSemester',
      'assessThemes',
      'assessYearEnd',
      'assessTickets',
      'assessRewards',
      'assessDayUnlocks',
    ]),
    group('education', ['eduSchool', 'eduPlanReviews', 'eduSettings', 'eduCurriculum']),
    ...boardingSection({
      nutrition: ['weeklyMenus', 'menuStatistics', 'menus'],
      kitchenOps: ['mealCount', 'publishedMenu', 'forecast', 'freshReceipts'],
      stock: ['dryStock', 'stockReceipts', 'stockHistory', 'stockShortfalls'],
      foodSafety: ['inspections', 'foodSamples', 'mealPhotos'],
      catalog: ['foods', 'dishes', 'nutritionSetup', 'suppliers'],
    }),
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
    group('children', ['childList', 'childEnroll', 'childPlacement', 'parentActivation', 'healthChecks', 'healthTrends']),
    group('attendance', ['attendanceSummary', 'leaveRequests', 'attendanceDayUnlocks', 'dailyHealthOverview']),
    group('education', ['eduGoals', 'eduPlanReviews', 'eduSettings', 'eduCurriculum']),
    group('assessment', [
      'assessOverview',
      'assessQuality',
      'assessClassRatings',
      'assessProgress',
      'assessSemester',
      'assessThemes',
      'assessYearEnd',
      'assessTickets',
      'assessRewards',
      'assessDayUnlocks',
    ]),
    ...boardingSection({
      nutrition: ['weeklyMenus', 'menuStatistics', 'menus', 'nutrition'],
      kitchenOps: ['mealCount', 'publishedMenu', 'forecast', 'freshReceipts'],
      stock: ['dryStock', 'stockReceipts', 'stockHistory', 'stockShortfalls'],
      foodSafety: ['inspections', 'foodSamples', 'mealPhotos'],
      catalog: ['foods', 'dishes', 'nutritionSetup', 'suppliers'],
    }),
    account,
    link('notifications'),
  ],
  [ROLES.TEAM_LEADER]: [
    link('home'),
    link('approvals'),
    group('children', ['childList', 'healthChecks', 'healthTrends']),
    group('attendance', ['attendance', 'attendanceSummary', 'leaveRequests', 'pickup']),
    group('education', ['eduGoals', 'eduBranch', 'eduClass', 'eduPlanReviews', 'eduCurriculum']),
    group('assessment', [
      'assessOverview',
      'assessDaily',
      'assessProfiles',
      'assessSemester',
      'assessThemes',
      'assessYearEnd',
      'assessQuality',
      'assessClassRatings',
      'assessTickets',
      'assessRewards',
    ]),
    account,
    link('notifications'),
  ],
  [ROLES.TEACHER]: [
    link('home'),
    group('children', ['childList', 'healthChecks', 'healthTrends']),
    group('attendance', ['attendance', 'attendanceSummary', 'leaveRequests', 'pickup']),
    group('education', ['eduGoals', 'eduBranch', 'eduClass', 'eduCurriculum']),
    group('assessment', [
      'assessDaily',
      'assessProfiles',
      'assessSemester',
      'assessThemes',
      'assessYearEnd',
      'assessQuality',
      'assessClassRatings',
      'assessTickets',
      'assessRewards',
    ]),
    account,
    link('notifications'),
  ],
  // AUTH-21: bếp chỉ dùng App, Web không có màn bán trú cho bếp
  [ROLES.KITCHEN_STAFF]: [link('home'), account, link('notifications')],
};

/** "Phân công giáo viên" follows the permission of the Role & Permission screen; every other item stays role-based. */
const withTeacherAssignment = (menu, user) => {
  const allowed = canOpenTeacherAssignment(user);
  const items = menu.map((e) =>
    e.children
      ? {
          ...e,
          children: e.children.filter((c) => c.key !== 'schoolTeachers'),
        }
      : e,
  );
  if (!allowed) return items;
  const entry = {
    ...ITEMS.schoolTeachers,
    key: 'schoolTeachers',
  };
  const school = items.find((e) => e.key === 'school');
  if (school)
    return items.map((e) =>
      e === school
        ? {
            ...e,
            children: [...e.children, entry],
          }
        : e,
    );
  return [
    items[0],
    ...items.slice(1, 2),
    {
      ...GROUPS.school,
      key: 'school',
      children: [entry],
    },
    ...items.slice(2),
  ];
};

/** Mảng chưa được thêm cho Phó hiệu trưởng (Không có): ẩn nhóm / mục menu tương ứng. */
const AREA_GROUPS = {
  menu: ['nutrition'],
  children: ['children'],
};
const AREA_ITEMS = {
  // NCC vẫn hiện để PHT lập phiếu nhập kho khi chưa được giao mảng thực đơn
  menu: ['foods', 'dishes', 'nutritionSetup'],
  rooms: ['schoolRooms'],
  staff: ['schoolStaffView'],
  yearPlacement: ['schoolPlacement'],
};
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
    .map((e) =>
      e.children
        ? {
            ...e,
            children: e.children.filter((c) => !hiddenItems.includes(c.key)),
          }
        : e,
    );
};

// Mục gắn với mã quyền BE thật: người dùng BE bị thu hồi quyền thì ẩn mục (BE vẫn chặn khi mở thẳng đường dẫn)
const ITEM_BE_PERMISSIONS = {
  parentActivation: [PERMISSIONS.PARENT_ACCOUNT_MANAGE],
  schoolRoles: [PERMISSIONS.PERMISSION_MANAGE],
};
const withBePermissions = (menu, user) =>
  menu
    .map((e) =>
      e.children
        ? {
            ...e,
            children: e.children.filter((c) => !ITEM_BE_PERMISSIONS[c.key] || hasBePermission(user, ...ITEM_BE_PERMISSIONS[c.key])),
          }
        : e,
    )
    .filter((e) => !e.children || e.children.length > 0);
// Màn chỉ có khi nối BE (build mock không có route) ⇒ ẩn mục ở build demo
// Không import demoSource ở đây: nó kéo mockDatabase (cần window) vào menu
const KITCHEN_RECORDS_API = !USE_MOCK && INTEGRATION_MODULES['kitchen-records']?.source === 'api';
const MEAL_PLAN_API = !USE_MOCK && INTEGRATION_MODULES['meal-plan']?.source === 'api';
const API_ONLY_ITEMS = [...(!KITCHEN_RECORDS_API ? ['mealPhotos'] : []), ...(!MEAL_PLAN_API ? ['menuStatistics'] : [])];
const withApiOnlyItems = (menu) =>
  API_ONLY_ITEMS.length
    ? menu.map((e) => (e.children ? { ...e, children: e.children.filter((c) => !API_ONLY_ITEMS.includes(c.key)) } : e))
    : menu;
// hiddenItems: mục cần ẩn theo dữ liệu tải sau (vd. "Duyệt kế hoạch, giáo án" của Hiệu trưởng khi Hiệu trưởng không ký)
export const getMenuForRole = (role, user, hiddenItems = []) =>
  withApiOnlyItems(
    withBePermissions(withVpAreas(withTeacherAssignment(MENUS[role] || [link('home'), account, link('notifications')], user), user), user),
  )
    .map((e) => (e.children && hiddenItems.length ? { ...e, children: e.children.filter((c) => !hiddenItems.includes(c.key)) } : e))
    .filter((e) => !e.children || e.children.length > 0);
