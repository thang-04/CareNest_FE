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
    files: ['src/services/school-config/api/schoolConfigApi.js', 'src/services/http/beClient.js'],
    facades: ['src/services/school-config/schoolConfigService.js'],
    // Hàm của staff-accounts, vice-principal-assignments (đang demo) nằm chung file API này
    pending: [
      'GET /users',
      'GET /users/{x}/role-change-impact',
      'PUT /users/{x}',
      'POST /users',
      'PATCH /users/{x}/profile',
      'PATCH /users/{x}/status',
      'GET /school-years/{x}/vice-principal-assignments',
      'PUT /school-years/{x}/vice-principal-assignments/{x}',
    ],
  },
  'staff-accounts': { source: 'demo', routes: ['/school/staff'], facades: ['src/services/school-config/schoolConfigService.js'] },
  'vice-principal-assignments': {
    source: 'demo',
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
  'meal-handover': { source: 'demo', routes: ['/attendance/meal-handover'], facades: ['src/services/attendance/attendanceService.js'] },
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
    // Danh bạ user dùng master-data-users (demo); danh mục tài sản thuộc CSVC (demo, ngoài V1)
    pending: ['GET /users', 'GET /asset-categories'],
  },
  // Danh bạ người dùng cho các màn demo; màn thật chỉ chọn user có id BE (RoomFormModal)
  'master-data-users': { source: 'demo', facades: ['src/services/masterDataService.js'] },
  // Lớp, trẻ dùng chung cho các màn demo (BE chưa có GET /classes)
  'school-lookup': { source: 'demo', files: ['src/services/schoolService.js'], facades: ['src/services/schoolService.js'] },
  children: {
    source: 'demo',
    routes: ['/children'],
    files: ['src/services/children/api/childrenApi.js', 'src/services/children/api/healthCheckApi.js'],
    facades: ['src/services/children/childrenService.js', 'src/services/children/healthCheckService.js'],
  },
  pickup: {
    source: 'demo',
    routes: ['/pickup'],
    files: ['src/services/pickup/api/pickupApi.js'],
    facades: ['src/services/pickup/pickupService.js'],
  },
  assessment: {
    source: 'demo',
    routes: ['/assessment'],
    files: ['src/services/assessment/api/assessmentApi.js'],
    facades: ['src/services/assessment/assessmentService.js'],
  },
  'menu-planning': {
    source: 'demo',
    routes: ['/menu'],
    files: ['src/services/menu-planning/api/menuPlanningApi.js'],
    facades: ['src/services/menu-planning/menuPlanningService.js'],
  },
  kitchen: {
    source: 'demo',
    routes: ['/kitchen'],
    files: ['src/services/kitchen/api/kitchenApi.js'],
    facades: ['src/services/kitchen/kitchenService.js'],
  },
  facility: {
    source: 'demo',
    routes: ['/facility'],
    files: ['src/services/facility/api/facilityApi.js'],
    facades: ['src/services/facility/facilityService.js', 'src/services/masterDataService.js'],
  },
  'facility-transfer': {
    source: 'demo',
    routes: ['/facility/transfers'],
    files: ['src/services/facility-transfer/api/transferApi.js'],
    facades: ['src/services/facility-transfer/transferService.js'],
  },
  'inventory-inspection': {
    source: 'demo',
    routes: ['/facility/inspections'],
    files: ['src/services/inventory-inspection/api/inspectionApi.js', 'src/services/facilityLockService.js'],
    facades: ['src/services/inventory-inspection/inspectionService.js', 'src/services/facilityLockService.js'],
  },
  notifications: {
    source: 'demo',
    routes: ['/notifications'],
    files: ['src/services/notificationService.js'],
    facades: ['src/services/notificationService.js'],
  },
  // Nhãn ở SignaturePicker (dùng trong màn kế hoạch giáo dục)
  signatures: { source: 'demo', files: ['src/services/signatureService.js'], facades: ['src/services/signatureService.js'] },
  appearance: {
    source: 'demo',
    routes: ['/settings/appearance'],
    files: ['src/services/appearance/api/appearanceApi.js'],
    facades: ['src/services/appearance/appearanceService.js'],
  },
};
