/**
 * Team lint rules. Run `npm run lint` before pushing.
 * Architecture rules (see docs/architecture/CODING_GUIDE.md §2, §4 and .claude/rules/architecture.md):
 *  - pages / components / hooks / contexts never touch localStorage or the mock database directly;
 *  - module A never imports module B's private code (only the root of src/pages may read several modules);
 *  - Tabler icons only through src/components/ui/icons.js.
 */
const fs = require('fs');
const path = require('path');

const LAYERS = ['components', 'pages', 'hooks', 'services', 'models', 'utils'];
const UI_LAYERS = ['components', 'pages', 'hooks'];
// Thư mục dùng chung ở gốc layer, không phải module nghiệp vụ
const SHARED_DIRS = new Set(['ui', 'form', 'charts', 'print', 'upload', 'signature', 'asset', 'brand', 'http']);

const MODULES = [
  ...new Set(
    LAYERS.flatMap((layer) => {
      const dir = path.join(__dirname, 'src', layer);
      return fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => fs.statSync(path.join(dir, n)).isDirectory()) : [];
    }),
  ),
]
  .filter((m) => !SHARED_DIRS.has(m))
  .sort();

/*
 * Nợ import chéo module có từ trước quy tắc (đo 2026-10-20). CHỈ ĐƯỢC XÓA BỚT khi refactor
 * (promote phần dùng chung hoặc chờ BE trả số liệu tổng hợp); không thêm dòng mới để lách lint.
 * file → các module khác mà file đó đang được phép import.
 */
const CROSS_MODULE_DEBT = {
  'src/components/assessment/DailyAssessmentCells.jsx': ['education-plan', 'school-config'],
  'src/components/assessment/PeriodSummaryTable.jsx': ['attendance', 'school-config'],
  'src/components/children/ClassPlacementFields.jsx': ['school-config'],
  'src/components/dashboard/ClassTodayPanel.jsx': ['assessment', 'attendance', 'education-plan', 'facility', 'pickup'],
  'src/components/dashboard/DashboardHeader.jsx': ['appearance'],
  'src/components/dashboard/FacilityTasksWidget.jsx': ['facility-transfer', 'inventory-inspection'],
  'src/components/permissions/OverrideWizardModal.jsx': ['account'],
  'src/components/permissions/PermissionBadges.jsx': ['account'],
  'src/components/permissions/PermissionTable.jsx': ['account'],
  'src/components/permissions/ReasonModal.jsx': ['account'],
  'src/models/attendance/attendanceConstants.js': ['menu-planning'],
  'src/models/kitchen/kitchenConstants.js': ['attendance'],
  'src/models/school-config/schoolConfigConstants.js': ['menu-planning'],
  'src/pages/children/ChildrenListPage.jsx': ['account'],
  'src/pages/children/ParentActivationPage.jsx': ['account'],
  'src/pages/dashboard/KitchenDashboard.jsx': ['kitchen'],
  'src/pages/dashboard/PrincipalDashboard.jsx': ['attendance', 'education-plan', 'facility', 'kitchen'],
  'src/pages/dashboard/TeamLeaderDashboard.jsx': ['education-plan'],
  'src/pages/dashboard/VicePrincipalDashboard.jsx': ['attendance', 'children', 'kitchen'],
  'src/pages/kitchen/ConfirmedMealCountPage.jsx': ['attendance'],
  'src/pages/kitchen/DryStockPage.jsx': ['menu-planning'],
  'src/pages/kitchen/KitchenFlowPage.jsx': ['dashboard'],
  'src/pages/kitchen/StockReceiptFormPage.jsx': ['menu-planning'],
  'src/pages/kitchen/StockReceiptListPage.jsx': ['menu-planning'],
  'src/pages/kitchen/SupplierDetailPage.jsx': ['menu-planning'],
  'src/pages/kitchen/WeeklyForecastPage.jsx': ['menu-planning'],
  'src/pages/permissions/UserOverridesPage.jsx': ['account', 'school-config'],
  'src/pages/school-config/PermissionHistoryPage.jsx': ['account', 'permissions'],
  'src/pages/school-config/RoleDefaultsPage.jsx': ['account', 'permissions'],
  'src/pages/school-config/StaffAccountsPage.jsx': ['account'],
  'src/pages/settings/AppearancePage.jsx': ['account', 'appearance'],
  'src/services/account/mock/guardianMockRepository.js': ['children', 'school-config'],
  'src/services/assessment/mock/aiEvaluationGenerator.js': ['attendance'],
  'src/services/assessment/mock/assessmentMockRepository.js': ['attendance', 'education-plan'],
  'src/services/attendance/mock/attendanceMockRepository.js': ['kitchen'],
  'src/services/children/mock/childrenMockRepository.js': ['school-config'],
  'src/services/dashboard/dashboardService.js': [
    'assessment',
    'attendance',
    'education-plan',
    'facility',
    'inventory-inspection',
    'kitchen',
  ],
  'src/services/dashboard/dashboardSummaryService.js': ['attendance', 'school-config'],
  'src/services/kitchen/mock/attendanceSource.js': ['attendance'],
  'src/services/kitchen/mock/kitchenMockRepository.js': ['attendance', 'menu-planning'],
  'src/services/kitchen/mock/marketList.js': ['menu-planning'],
  'src/services/kitchen/mock/weeklyForecast.js': ['menu-planning'],
  'src/services/school-config/mock/schoolConfigMockRepository.js': ['attendance'],
  'src/utils/account/peopleNavigation.js': ['children', 'school-config'],
  'src/utils/assessment/assessmentPeriods.js': ['education-plan'],
  'src/utils/children/childrenPermissions.js': ['school-config'],
  'src/utils/education-plan/goalCsv.js': ['children'],
  'src/utils/facility-transfer/transferPermissions.js': ['school-config'],
  'src/utils/facility/facilityPermissions.js': ['school-config'],
  'src/utils/inventory-inspection/inspectionPermissions.js': ['school-config'],
  'src/utils/menu-planning/menuPlanningPermissions.js': ['school-config'],
};

// Nợ hook/context import @/mocks (sự kiện đổi dữ liệu); chỉ được xóa bớt.
const MOCK_IMPORT_DEBT = [
  'src/contexts/SchoolYearContext.jsx',
  'src/hooks/account/useGuardianQuery.js',
  'src/hooks/account/usePermissions.js',
  'src/hooks/kitchen/useKitchen.js',
  'src/hooks/useAsync.js',
];

const MOCK_PATTERN = {
  group: ['**/mocks/**', '@/mocks/*'],
  message: 'UI/hook không import mock trực tiếp. Gọi service (src/services/<module>/*Service.js).',
};
const ICON_PATTERN = {
  group: ['@tabler/icons-react', '@tabler/icons-react/*'],
  message: 'Icon chỉ import qua @/components/ui/icons (thêm icon mới vào icons.js).',
};

const crossModulePattern = (self, allowed = []) => {
  const others = MODULES.filter((m) => m !== self && !allowed.includes(m));
  return others.length
    ? [
        {
          group: others.flatMap((m) => LAYERS.map((layer) => `@/${layer}/${m}/**`)),
          message: `Module "${self}" không import code riêng của module khác. Dùng chung ở ≥2 module ⇒ chuyển lên phần chung (CODING_GUIDE §2, DESIGN §6.3).`,
        },
      ]
    : [];
};

const restrict = (patterns) => ['error', { patterns: [ICON_PATTERN, ...patterns] }];
const NO_STORAGE = [
  'error',
  { name: 'localStorage', message: 'Không dùng localStorage trong UI. Lưu dữ liệu qua service.' },
  { name: 'sessionStorage', message: 'Không dùng sessionStorage trong UI.' },
];

const moduleOf = (file) => {
  const parts = file.split('/');
  return parts[0] === 'src' && LAYERS.includes(parts[1]) && MODULES.includes(parts[2]) ? parts[2] : null;
};
const isUiFile = (file) => UI_LAYERS.some((layer) => file.startsWith(`src/${layer}/`)) || file.startsWith('src/contexts/');

const moduleOverrides = MODULES.flatMap((m) => [
  {
    files: UI_LAYERS.map((layer) => `src/${layer}/${m}/**`),
    rules: { 'no-restricted-imports': restrict([MOCK_PATTERN, ...crossModulePattern(m)]), 'no-restricted-globals': NO_STORAGE },
  },
  {
    files: ['services', 'models', 'utils'].map((layer) => `src/${layer}/${m}/**`),
    rules: { 'no-restricted-imports': restrict(crossModulePattern(m)) },
  },
]);

const debtOverrides = Object.entries(CROSS_MODULE_DEBT).map(([file, allowed]) => {
  const m = moduleOf(file);
  const mockAllowed = MOCK_IMPORT_DEBT.includes(file);
  return {
    files: [file],
    rules: {
      'no-restricted-imports': restrict([...(isUiFile(file) && !mockAllowed ? [MOCK_PATTERN] : []), ...crossModulePattern(m, allowed)]),
    },
  };
});

const mockDebtOverrides = MOCK_IMPORT_DEBT.filter((file) => !CROSS_MODULE_DEBT[file]).map((file) => {
  const m = moduleOf(file);
  return { files: [file], rules: { 'no-restricted-imports': restrict(m ? crossModulePattern(m) : []) } };
});

module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  settings: { react: { version: 'detect' } },
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:react/jsx-runtime', 'plugin:react-hooks/recommended', 'prettier'],
  ignorePatterns: ['dist', 'node_modules'],
  rules: {
    'react/prop-types': 'off',
    'react/no-unescaped-entities': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'smart'],
    'prefer-const': 'error',
    'no-restricted-imports': restrict([]),
  },
  overrides: [
    {
      // Phần chung + trang gốc src/pages: không mock, không storage; trang gốc được đọc nhiều module.
      files: ['src/pages/**', 'src/components/**', 'src/hooks/**', 'src/contexts/**'],
      rules: { 'no-restricted-imports': restrict([MOCK_PATTERN]), 'no-restricted-globals': NO_STORAGE },
    },
    ...moduleOverrides,
    ...debtOverrides,
    ...mockDebtOverrides,
    { files: ['src/components/ui/icons.js'], rules: { 'no-restricted-imports': 'off' } },
  ],
};
