/*
 * Nguồn dữ liệu từng module khi build nối BE (VITE_USE_MOCK=false). `api` = BE thật; `demo` = dữ liệu mẫu trong trình duyệt,
 * màn vẫn hiển thị kèm nhãn "Dữ liệu demo" (user chốt 2026-11-01: không ẩn). VITE_USE_MOCK=true ⇒ mọi module dùng mock.
 *
 * `routes`: tiền tố màn của module (khớp dài nhất) — màn module demo hiện nhãn. `files`: file gọi HTTP của module.
 * `facades`: file chọn mock/api; module demo phải chọn nguồn qua sourceOf/isDemoModule với khóa module trong đó.
 * `pending`: lời gọi của module `api` mà BE chưa có (`METHOD /path`, tham số = {x}) — khai rõ để cổng không báo lỗi.
 * Đổi `demo` → `api` khi BE đủ endpoint; `node scripts/check-api-contract.mjs` kiểm (chạy trong `npm run verify`).
 * Data thuần, không import: script Node đọc được.
 */
export const INTEGRATION_MODULES = {
  account: {
    source: 'api',
    routes: ['/account'],
    files: ['src/services/account/api/accountApi.js', 'src/services/authService.js'],
    pending: ['GET /notifications/{x}'],
  },
  permission: {
    source: 'api',
    routes: ['/school/roles', '/permissions'],
    files: ['src/services/account/api/permissionApi.js'],
    facades: ['src/services/account/permissionService.js'],
  },
  guardian: {
    source: 'api',
    routes: ['/children/activation'],
    files: ['src/services/account/api/guardianApi.js'],
    facades: ['src/services/account/guardianService.js'],
  },
  'school-config': {
    source: 'api',
    routes: ['/school'],
    files: [
      'src/services/school-config/api/schoolConfigApi.js',
      'src/services/school-config/schoolConfigService.js',
      'src/services/http/beClient.js',
    ],
    facades: ['src/services/school-config/schoolConfigService.js'],
    // Hàm của staff-accounts, vice-principal-assignments (đang demo) nằm chung file API này
    pending: [
      'GET /users',
      'GET /users/{x}/role-change-impact',
      'PUT /users/{x}',
      'POST /users',
      'PATCH /users/{x}/profile',
      'PATCH /users/{x}/status',
    ],
  },
  // Màn /school/staff nối BE /accounts (school-config); các hàm sửa hồ sơ / đổi vai trò chưa có BE vẫn demo, không gắn route
  'staff-accounts': {
    source: 'demo',
    facades: ['src/services/school-config/schoolConfigService.js'],
  },
  'vice-principal-assignments': {
    source: 'api',
    routes: ['/school/vice-principals'],
    facades: ['src/services/school-config/schoolConfigService.js'],
  },
  attendance: {
    source: 'api',
    routes: ['/attendance'],
    files: ['src/services/attendance/api/attendanceApi.js'],
    facades: ['src/services/attendance/attendanceService.js'],
    // Bàn giao bữa (meal-handover, đang demo) nằm chung file API này
    pending: [
      'GET /meal-handovers',
      'POST /meal-handovers/{x}/confirm',
      'POST /meal-handovers/{x}/shortage',
      'POST /meal-handovers/{x}/supplement',
    ],
  },
  'meal-handover': {
    source: 'demo',
    routes: ['/attendance/meal-handover'],
    facades: ['src/services/attendance/attendanceService.js'],
  },
  'daily-health': {
    source: 'api',
    routes: ['/attendance/health'],
    files: ['src/services/daily-health/api/dailyHealthApi.js'],
    // Gateway tắt nút báo phụ huynh (PARENT_NOTIFY_ENABLED) tới khi BE có thông báo
    pending: ['POST /daily-health-entries/{x}/parent-notifications'],
  },
  'education-plan': {
    source: 'api',
    routes: ['/education'],
    files: ['src/services/education-plan/api/educationPlanApi.js', 'src/services/education-plan/learningResourceService.js'],
    pending: [
      'GET /education-plans/curriculum/{x}',
      'PUT /education-plans/themes/{x}',
      'DELETE /education-plans/themes/{x}',
      'PUT /education-plans/lessons/{x}',
      'DELETE /education-plans/lessons/{x}',
      'POST /education-plans/ai/branch-names',
      'POST /education-plans/ai/branch-names/rewrite',
      'POST /education-plans/ai/lesson-steps',
    ],
  },
  'master-data': {
    source: 'api',
    files: ['src/services/masterDataService.js'],
    facades: ['src/services/masterDataService.js'],
    // Danh bạ người dùng demo
    pending: ['GET /users'],
  },
  // Danh bạ người dùng cho các màn demo; màn thật chỉ chọn user có id BE (RoomFormModal)
  'master-data-users': {
    source: 'demo',
    facades: ['src/services/masterDataService.js'],
  },
  // Lớp, trẻ dùng chung cho các màn demo (BE chưa có GET /classes)
  'school-lookup': {
    source: 'demo',
    files: ['src/services/schoolService.js'],
    facades: ['src/services/schoolService.js'],
  },
  // Hồ sơ trẻ, sức khỏe trên BE (nhánh G94-180): plan docs/plans/active/2026-11-11-children-module-be-wiring.md
  children: {
    source: 'api',
    routes: ['/children'],
    files: [
      'src/services/children/api/childrenApi.js',
      'src/services/children/api/healthCheckApi.js',
      'src/services/http/schoolYearIds.js',
    ],
    facades: ['src/services/children/childrenService.js', 'src/services/children/healthCheckService.js'],
  },
  pickup: {
    source: 'demo',
    routes: ['/pickup'],
    files: ['src/services/pickup/api/pickupApi.js'],
    facades: ['src/services/pickup/pickupService.js'],
  },
  assessment: {
    source: 'api',
    routes: ['/assessment'],
    files: ['src/services/assessment/api/assessmentApi.js'],
    facades: ['src/services/assessment/assessmentService.js'],
  },
  // Danh mục bán trú (thực phẩm, món, cấu hình nhóm tuổi, nhà cung cấp) trên BE /nutrition/*; route dài hơn nên thắng '/menu'
  'nutrition-catalog': {
    source: 'api',
    routes: ['/menu/foods', '/menu/dishes', '/menu/setup', '/menu/suppliers'],
    files: ['src/services/nutritionCatalogApi.js'],
    facades: ['src/services/menu-planning/menuPlanningService.js', 'src/services/kitchen/kitchenService.js'],
  },
  // Kho khô trên BE /nutrition/stock/*: tồn theo lô, phiếu nhập, lịch sử nhập/trừ, phần thiếu; route dài hơn nên thắng '/kitchen'
  'dry-stock': {
    source: 'api',
    routes: ['/kitchen/dry-stock', '/kitchen/stock-receipts', '/kitchen/stock-history', '/kitchen/stock-shortfalls'],
    files: ['src/services/dryStockApi.js'],
  },
  // Hàng tươi trên BE: bản dự trù /nutrition/fresh-forecasts và kiểm nhận hai lần /nutrition/fresh-checks; route dài hơn nên thắng '/kitchen'
  'fresh-goods': {
    source: 'api',
    routes: ['/kitchen/forecast', '/kitchen/fresh-receipts'],
    files: ['src/services/freshGoodsApi.js'],
  },
  // Bếp hôm nay (xem), lưu mẫu thức ăn (duyệt), ảnh bữa, khung giờ ảnh trên BE /nutrition/{kitchen/day,food-samples,meal-photos,meal-photo-windows}
  'kitchen-records': {
    source: 'api',
    routes: ['/kitchen/published-menu', '/kitchen/food-samples', '/kitchen/meal-photos', '/kitchen/photo-windows'],
    files: ['src/services/kitchenRecordsApi.js'],
  },
  // Kế hoạch tuần theo khối + công bố trên BE /nutrition/meal-plans; thắng '/menu' của thực đơn mẫu còn demo
  'meal-plan': {
    source: 'api',
    routes: ['/menu/weekly', '/menu/statistics'],
    files: ['src/services/mealPlanApi.js'],
  },
  // Mẫu thực đơn một ngày theo khối trên BE /nutrition/menu-templates (NUT-13, đổi 04/11)
  'menu-template': {
    source: 'api',
    routes: ['/menu/templates'],
    files: ['src/services/menuTemplateApi.js'],
  },
  // Bán trú hôm nay trên BE GET /nutrition/day-board
  'day-board': {
    source: 'api',
    routes: ['/boarding'],
    files: ['src/services/dayBoardApi.js'],
  },
  // Thực đơn mẫu, thư viện tham khảo còn tham chiếu id món/thực phẩm mẫu ⇒ còn demo
  'menu-planning': {
    source: 'demo',
    routes: ['/menu'],
    files: ['src/services/menu-planning/api/menuPlanningApi.js'],
    facades: ['src/services/menu-planning/menuPlanningService.js'],
  },
  // Sổ báo ăn đã xác nhận: BE có GET /meal-counts ⇒ màn này dùng số thật, các màn bếp khác còn demo
  'kitchen-meal-count': {
    source: 'api',
    routes: ['/kitchen/meal-count'],
    files: ['src/services/kitchen/api/confirmedMealCountApi.js'],
    facades: ['src/services/kitchen/kitchenService.js'],
  },
  kitchen: {
    source: 'demo',
    routes: ['/kitchen'],
    files: ['src/services/kitchen/api/kitchenApi.js'],
    facades: ['src/services/kitchen/kitchenService.js'],
  },
  notifications: {
    source: 'demo',
    routes: ['/notifications'],
    files: ['src/services/notificationService.js'],
    facades: ['src/services/notificationService.js'],
  },
  // Nhãn ở SignaturePicker (dùng trong màn kế hoạch giáo dục)
  signatures: {
    source: 'demo',
    files: ['src/services/signatureService.js'],
    facades: ['src/services/signatureService.js'],
  },
  appearance: {
    source: 'demo',
    routes: ['/settings/appearance'],
    files: ['src/services/appearance/api/appearanceApi.js'],
    facades: ['src/services/appearance/appearanceService.js'],
  },
};
