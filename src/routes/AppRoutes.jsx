import { Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { lazyPage, registerRouteTree } from './routePrefetch';
import { MainLayout } from '@/layouts/MainLayout';
import { RoleGuard } from './RoleGuard';
import { ProtectedRoute, GuestRoute } from './ProtectedRoute';
import { AppSplash } from '@/components/ui/AppSplash';
import { ROLES } from '@/models/User';
import { PERMISSIONS } from '@/models/bePermissions';
import { hasBePermission } from '@/utils/bePermissions';
import HomePage from '@/pages/HomePage';
import ComingSoonPage from '@/pages/ComingSoonPage';
import NotificationsPage from '@/pages/NotificationsPage';
import NotFoundPage from '@/pages/NotFoundPage';
import { canOpenTeacherAssignment } from '@/utils/school-config/schoolConfigPermissions';
import { canManageParentAccounts } from '@/utils/account/accountPermissions';
import { isDemoModule } from '@/services/demoSource';

// Thư viện UI chỉ cho bản dev: bản build prod bỏ cả route lẫn chunk.
const UiKitPage = import.meta.env.DEV ? lazyPage(() => import('@/pages/UiKitPage')) : null;
const LoginPage = lazyPage(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazyPage(() => import('@/pages/account/ForgotPasswordPage'));
const VerifyOtpPage = lazyPage(() => import('@/pages/account/VerifyOtpPage'));
const ResetPasswordPage = lazyPage(() => import('@/pages/account/ResetPasswordPage'));
const ProfilePage = lazyPage(() => import('@/pages/account/ProfilePage'));
const ChangePasswordPage = lazyPage(() => import('@/pages/account/ChangePasswordPage'));
const NotificationDetailPage = lazyPage(() => import('@/pages/account/NotificationDetailPage'));
const AppearancePage = lazyPage(() => import('@/pages/settings/AppearancePage'));

/** Public page for signed-out users only (login, password recovery). */
const guest = (page) => (
  <GuestRoute>
    <Suspense fallback={<AppSplash />}>{page}</Suspense>
  </GuestRoute>
);
const EducationPlanLayout = lazyPage(() => import('@/components/education-plan/EducationPlanLayout'));
const EducationHomeRedirect = lazyPage(() => import('@/pages/education-plan/EducationHomeRedirect'));
const GoalsEntry = lazyPage(() =>
  import('@/pages/education-plan/GoalListPage').then((m) => ({
    default: m.GoalsEntry,
  })),
);
const GoalFormPage = lazyPage(() => import('@/pages/education-plan/GoalFormPage'));
const GoalDetailPage = lazyPage(() => import('@/pages/education-plan/GoalDetailPage'));
const ClassPlanPage = lazyPage(() => import('@/pages/education-plan/ClassPlanPage'));
const ClassPlanRedirect = lazyPage(() =>
  import('@/pages/education-plan/ClassPlanPage').then((m) => ({
    default: m.ClassPlanRedirect,
  })),
);
const BranchPlanPage = lazyPage(() => import('@/pages/education-plan/BranchPlanPage'));
const BranchPlanLegacyRedirect = lazyPage(() =>
  import('@/pages/education-plan/BranchPlanPage').then((m) => ({
    default: m.BranchPlanLegacyRedirect,
  })),
);
const ClassThemePlanPage = lazyPage(() => import('@/pages/education-plan/ClassThemePlanPage'));
const TeachingPresentationPage = lazyPage(() => import('@/pages/education-plan/TeachingPresentationPage'));
const WeekPlanPage = lazyPage(() => import('@/pages/education-plan/WeekPlanPage'));
const PlanReviewQueuePage = lazyPage(() => import('@/pages/education-plan/PlanReviewQueuePage'));
const EduConfigPage = lazyPage(() => import('@/pages/education-plan/EduConfigPage'));
const CurriculumSourcesPage = lazyPage(() => import('@/pages/education-plan/CurriculumSourcesPage'));
const SchoolPlansPage = lazyPage(() => import('@/pages/education-plan/SchoolPlansPage'));
const AttendancePage = lazyPage(() => import('@/pages/attendance/AttendancePage'));
const AttendanceDayUnlockPage = lazyPage(() => import('@/pages/attendance/AttendanceDayUnlockPage'));
const AttendanceSummaryPage = lazyPage(() => import('@/pages/attendance/AttendanceSummaryPage'));
const MealCountPage = lazyPage(() => import('@/pages/attendance/MealCountPage'));
const LeaveRequestsPage = lazyPage(() => import('@/pages/attendance/LeaveRequestsPage'));
const DailyHealthOverviewPage = lazyPage(() => import('@/pages/attendance/DailyHealthOverviewPage'));
const PickupListPage = lazyPage(() => import('@/pages/pickup/PickupListPage'));
const PickupVerifyPage = lazyPage(() => import('@/pages/pickup/PickupVerifyPage'));
const PickupResultPage = lazyPage(() => import('@/pages/pickup/PickupResultPage'));
const SchoolYearListPage = lazyPage(() => import('@/pages/school-config/SchoolYearListPage'));
const SchoolYearFormPage = lazyPage(() => import('@/pages/school-config/SchoolYearFormPage'));
const SchoolYearSetupPage = lazyPage(() => import('@/pages/school-config/SchoolYearSetupPage'));
const AgeGroupsClassesPage = lazyPage(() => import('@/pages/school-config/AgeGroupsClassesPage'));
const RoomListPage = lazyPage(() => import('@/pages/school-config/RoomListPage'));
const StaffAccountsPage = lazyPage(() => import('@/pages/school-config/StaffAccountsPage'));
const CutoffSettingPage = lazyPage(() => import('@/pages/school-config/CutoffSettingPage'));
const CampusListPage = lazyPage(() => import('@/pages/school-config/CampusListPage'));
const CampusFormPage = lazyPage(() => import('@/pages/school-config/CampusFormPage'));
const CampusDetailPage = lazyPage(() => import('@/pages/school-config/CampusDetailPage'));
const VicePrincipalAssignmentPage = lazyPage(() => import('@/pages/school-config/VicePrincipalAssignmentPage'));
const RoleDefaultsPage = lazyPage(() => import('@/pages/school-config/RoleDefaultsPage'));
const UserOverridesPage = lazyPage(() => import('@/pages/permissions/UserOverridesPage'));
const PermissionHistoryPage = lazyPage(() => import('@/pages/school-config/PermissionHistoryPage'));
const TeacherAssignmentPage = lazyPage(() => import('@/pages/school-config/TeacherAssignmentPage'));
const YearPlacementPage = lazyPage(() => import('@/pages/school-config/YearPlacementPage'));
const ChildrenListPage = lazyPage(() => import('@/pages/children/ChildrenListPage'));
const EnrollChildPage = lazyPage(() => import('@/pages/children/EnrollChildPage'));
const ImportChildrenPage = lazyPage(() => import('@/pages/children/ImportChildrenPage'));
const ClassPlacementPage = lazyPage(() => import('@/pages/children/ClassPlacementPage'));
const ParentActivationPage = lazyPage(() => import('@/pages/children/ParentActivationPage'));
const ChildProfilePage = lazyPage(() => import('@/pages/children/ChildProfilePage'));
const EditChildPage = lazyPage(() => import('@/pages/children/EditChildPage'));
const HealthDeclarationPage = lazyPage(() => import('@/pages/children/HealthDeclarationPage'));
const ChildHealthRecordPage = lazyPage(() => import('@/pages/children/ChildHealthRecordPage'));
const HealthMeasurementFormPage = lazyPage(() => import('@/pages/children/HealthMeasurementFormPage'));
const HealthTrendPage = lazyPage(() => import('@/pages/children/HealthTrendPage'));
const HealthCheckListPage = lazyPage(() => import('@/pages/children/HealthCheckListPage'));
const HealthCheckFormPage = lazyPage(() => import('@/pages/children/HealthCheckFormPage'));
const HealthCheckDetailPage = lazyPage(() => import('@/pages/children/HealthCheckDetailPage'));
const HealthExamFormPage = lazyPage(() => import('@/pages/children/HealthExamFormPage'));
const BoardingTodayPage = lazyPage(() => import('@/pages/boarding/BoardingTodayPage'));
const DryStockLedgerPage = lazyPage(() => import('@/pages/kitchen/DryStockLedgerPage'));
const StockReceiptEditorPage = lazyPage(() => import('@/pages/kitchen/StockReceiptEditorPage'));
const StockReceiptListPage = lazyPage(() => import('@/pages/kitchen/StockReceiptListPage'));
const StockReceiptFormPage = lazyPage(() => import('@/pages/kitchen/StockReceiptFormPage'));
const SupplierListPage = lazyPage(() => import('@/pages/kitchen/SupplierListPage'));
const SupplierDetailPage = lazyPage(() => import('@/pages/kitchen/SupplierDetailPage'));
const KitchenFlowPage = lazyPage(() => import('@/pages/kitchen/KitchenFlowPage'));
const DryStockPage = lazyPage(() => import('@/pages/kitchen/DryStockPage'));
const FoodSampleLogPage = lazyPage(() => import('@/pages/kitchen/FoodSampleLogPage'));
const WeeklyForecastPage = lazyPage(() => import('@/pages/kitchen/WeeklyForecastPage'));
const FreshReceiptPage = lazyPage(() => import('@/pages/kitchen/FreshReceiptPage'));
const FreshForecastPage = lazyPage(() => import('@/pages/kitchen/FreshForecastPage'));
const FreshCheckPage = lazyPage(() => import('@/pages/kitchen/FreshCheckPage'));
const PublishedMenuPage = lazyPage(() => import('@/pages/kitchen/PublishedMenuPage'));
const KitchenTodayPage = lazyPage(() => import('@/pages/kitchen/KitchenTodayPage'));
const FoodSampleQueuePage = lazyPage(() => import('@/pages/kitchen/FoodSampleQueuePage'));
const MealPhotosPage = lazyPage(() => import('@/pages/kitchen/MealPhotosPage'));
const MealPhotoWindowsPage = lazyPage(() => import('@/pages/kitchen/MealPhotoWindowsPage'));
const ConfirmedMealCountPage = lazyPage(() => import('@/pages/kitchen/ConfirmedMealCountPage'));
const RequiredFoodQuantityPage = lazyPage(() => import('@/pages/kitchen/RequiredFoodQuantityPage'));
const MissingFoodReportPage = lazyPage(() => import('@/pages/kitchen/MissingFoodReportPage'));
const DailyAssessmentPage = lazyPage(() => import('@/pages/assessment/DailyAssessmentPage'));
const DailyGoalAssessmentPage = lazyPage(() => import('@/pages/assessment/DailyGoalAssessmentPage'));
const AssessmentDayUnlockPage = lazyPage(() => import('@/pages/assessment/AssessmentDayUnlockPage'));
const ChildDevelopmentListPage = lazyPage(() => import('@/pages/assessment/ChildDevelopmentListPage'));
const ChildDevelopmentProfilePage = lazyPage(() => import('@/pages/assessment/ChildDevelopmentProfilePage'));
const ChildDevelopmentProgressPage = lazyPage(() => import('@/pages/assessment/ChildDevelopmentProgressPage'));
const AiEvaluationDraftPage = lazyPage(() => import('@/pages/assessment/AiEvaluationDraftPage'));
const ClassRatingsPage = lazyPage(() => import('@/pages/assessment/ClassRatingsPage'));
const SemesterEvaluationListPage = lazyPage(() => import('@/pages/assessment/SemesterEvaluationListPage'));
const SemesterEvaluationDetailPage = lazyPage(() => import('@/pages/assessment/SemesterEvaluationDetailPage'));
const YearEndEvaluationListPage = lazyPage(() => import('@/pages/assessment/YearEndEvaluationListPage'));
const YearEndEvaluationDetailPage = lazyPage(() => import('@/pages/assessment/YearEndEvaluationDetailPage'));
const GoodBehaviourTicketsPage = lazyPage(() => import('@/pages/assessment/GoodBehaviourTicketsPage'));
const ClassAssessmentOverviewPage = lazyPage(() => import('@/pages/assessment/ClassAssessmentOverviewPage'));
const ThemeEvaluationPage = lazyPage(() => import('@/pages/assessment/ThemeEvaluationPage'));
const QualityReportPage = lazyPage(() => import('@/pages/assessment/QualityReportPage'));
const RewardListPage = lazyPage(() => import('@/pages/assessment/RewardListPage'));
const RewardClassPage = lazyPage(() => import('@/pages/assessment/RewardClassPage'));
const PendingApprovalsPage = lazyPage(() => import('@/pages/dashboard/PendingApprovalsPage'));
const FoodListPage = lazyPage(() => import('@/pages/menu-planning/FoodListPage'));
const NutritionFlowPage = lazyPage(() => import('@/pages/menu-planning/NutritionFlowPage'));
const NutritionSetupPage = lazyPage(() => import('@/pages/menu-planning/NutritionSetupPage'));
const FoodDetailPage = lazyPage(() => import('@/pages/menu-planning/FoodDetailPage'));
const FoodFormPage = lazyPage(() => import('@/pages/menu-planning/FoodFormPage'));
const DishListPage = lazyPage(() => import('@/pages/menu-planning/DishListPage'));
const DishDetailPage = lazyPage(() => import('@/pages/menu-planning/DishDetailPage'));
const DishFormPage = lazyPage(() => import('@/pages/menu-planning/DishFormPage'));
const MenuListPage = lazyPage(() => import('@/pages/menu-planning/MenuListPage'));
const MenuDetailPage = lazyPage(() => import('@/pages/menu-planning/MenuDetailPage'));
const MenuFormPage = lazyPage(() => import('@/pages/menu-planning/MenuFormPage'));
const AllergyMenuListPage = lazyPage(() => import('@/pages/menu-planning/AllergyMenuListPage'));
const AllergyMenuDetailPage = lazyPage(() => import('@/pages/menu-planning/AllergyMenuDetailPage'));
const AllergyMenuFormPage = lazyPage(() => import('@/pages/menu-planning/AllergyMenuFormPage'));
const AiMenuSuggestionPage = lazyPage(() => import('@/pages/menu-planning/AiMenuSuggestionPage'));
const WeeklyMenuListPage = lazyPage(() => import('@/pages/menu-planning/WeeklyMenuListPage'));
const WeeklyMenuDetailPage = lazyPage(() => import('@/pages/menu-planning/WeeklyMenuDetailPage'));
const WeeklyMenuFormPage = lazyPage(() => import('@/pages/menu-planning/WeeklyMenuFormPage'));
const NutritionBalancePage = lazyPage(() => import('@/pages/menu-planning/NutritionBalancePage'));
const WeeklyPlanPage = lazyPage(() => import('@/pages/menu-planning/WeeklyPlanPage'));
const MenuTemplateListPage = lazyPage(() => import('@/pages/menu-planning/MenuTemplateListPage'));
const MenuTemplateEditorPage = lazyPage(() => import('@/pages/menu-planning/MenuTemplateEditorPage'));
const MenuStatisticsPage = lazyPage(() => import('@/pages/menu-planning/MenuStatisticsPage'));
const MenuPlanListPage = lazyPage(() => import('@/pages/menu-planning/MenuPlanListPage'));
const MenuPlanDetailPage = lazyPage(() => import('@/pages/menu-planning/MenuPlanDetailPage'));
const R = ROLES;
const CLASS_STAFF = [R.TEACHER, R.TEAM_LEADER];
const LEADERS = [R.PRINCIPAL, R.VICE_PRINCIPAL];
// Danh mục bán trú: HT, PHT đều xem; nút sửa theo NUTRITION_MANAGE khi dùng BE (BE vẫn kiểm). Form bản demo giữ phân quyền cũ.
const CATALOG_API = !isDemoModule('nutrition-catalog');
const CATALOG_READERS = LEADERS;
const CATALOG_EDITORS = LEADERS;
// Bán trú nối BE (hub, kế hoạch tuần, kho khô): build mock (VITE_USE_MOCK mặc định) giữ màn demo cũ, không có mock cho contract mới.
const BOARDING_API = !isDemoModule('day-board');
const MEAL_PLAN_API = !isDemoModule('meal-plan');
const TEMPLATE_API = !isDemoModule('menu-template');
const DRY_STOCK_API = !isDemoModule('dry-stock');
const FRESH_GOODS_API = !isDemoModule('fresh-goods');
const KITCHEN_RECORDS_API = !isDemoModule('kitchen-records');
const STOCK_RECEIPT_ROLES = LEADERS;
const DENIED = 'Chức năng này không thuộc quyền của vai trò hiện tại (theo ma trận phân quyền của hệ thống).';

/** Trang hồ sơ chủ đề đã bỏ (Tiền 04/11): link cũ .../review mở trang kế hoạch chủ đề. */
function ThemeReviewRedirect() {
  const { classId, themeId } = useParams();
  return <Navigate to={`/education/class/${classId}/themes/${themeId}`} replace />;
}

function SupplierRedirect() {
  const { id } = useParams();
  return <Navigate to={`/menu/suppliers/${id}`} replace />;
}

/** Route element limited to the roles allowed by the SRS permission matrix. */
const only = (roles, page) => (
  <RoleGuard roles={roles} description={DENIED}>
    {page}
  </RoleGuard>
);
/** Route thuộc ba phân hệ nghiệp vụ: BE cấp quyền hiệu lực; mock vẫn dùng dữ liệu demo hiện có. */
const permit = (codes, page) => (
  <RoleGuard allow={(user) => hasBePermission(user, ...codes)} description={DENIED}>
    {page}
  </RoleGuard>
);
const EDU_VP_TL = [ROLES.VICE_PRINCIPAL, ROLES.TEAM_LEADER];
const EDU_ALL = [ROLES.VICE_PRINCIPAL, ROLES.TEAM_LEADER, ROLES.TEACHER];
// Hiệu trưởng: xem toàn bộ (SRS 4.4 – Lesson plan View: Full), không sửa/duyệt.
const EDU_VIEW = [ROLES.PRINCIPAL, ...EDU_ALL];
const EDU_DENIED =
  'Chức năng này dành cho Hiệu trưởng (chỉ xem), Phó hiệu trưởng, tổ trưởng nhóm tuổi hoặc giáo viên theo từng bước của kế hoạch giáo dục.';

/** Route element guarded for education-plan roles. */
const edu = (roles, page, description = EDU_DENIED) => (
  <RoleGuard roles={roles} description={description}>
    {page}
  </RoleGuard>
);
export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route
        path="login"
        element={
          <GuestRoute>
            <Suspense fallback={<AppSplash />}>
              <LoginPage />
            </Suspense>
          </GuestRoute>
        }
      />

      <Route path="forgot-password" element={guest(<ForgotPasswordPage />)} />
      <Route path="verify-otp" element={guest(<VerifyOtpPage />)} />
      <Route path="reset-password" element={guest(<ResetPasswordPage />)} />

      {/* Everything else requires a logged-in user */}
      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          {false}
          <Route path="education" element={<EducationPlanLayout />}>
            <Route index element={edu(EDU_VIEW, <EducationHomeRedirect />)} />
            <Route path="school" element={edu([ROLES.PRINCIPAL], <SchoolPlansPage />)} />
            <Route path="goals" element={edu(EDU_ALL, <GoalsEntry />)} />
            <Route path="goals/new" element={edu(EDU_VP_TL, <GoalFormPage />)} />
            <Route path="goals/:id" element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <GoalDetailPage />)} />
            <Route path="goals/:id/edit" element={edu(EDU_VP_TL, <GoalFormPage />)} />
            <Route path="class" element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <ClassPlanRedirect />)} />
            <Route path="class/:classId" element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <ClassPlanPage />)} />
            <Route
              path="branches"
              element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <ClassPlanRedirect toOf={(id) => `/education/branches/${id}`} />)}
            />
            <Route path="branches/:classId" element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <BranchPlanPage />)} />
            <Route path="class/:classId/branches" element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <BranchPlanLegacyRedirect />)} />
            <Route path="class/:classId/branches/review" element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <BranchPlanLegacyRedirect />)} />
            <Route path="class/:classId/themes/:themeId" element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <ClassThemePlanPage />)} />
            <Route path="class/:classId/themes/:themeId/teach" element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <TeachingPresentationPage />)} />
            <Route path="class/:classId/themes/:themeId/review" element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <ThemeReviewRedirect />)} />
            <Route path="class/:classId/weeks/:weekStart" element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <WeekPlanPage />)} />
            <Route path="class/:classId/weeks/:weekStart/review" element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <WeekPlanPage review />)} />
            <Route path="plan-reviews" element={edu([ROLES.PRINCIPAL, ...EDU_VP_TL], <PlanReviewQueuePage />)} />
            <Route path="curriculum-sources" element={edu([ROLES.PRINCIPAL, ...EDU_ALL], <CurriculumSourcesPage />)} />
            <Route
              path="settings"
              element={edu(
                [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL],
                <EduConfigPage />,
                'Cấu hình kế hoạch giáo dục dành cho Hiệu trưởng và Phó hiệu trưởng.',
              )}
            />
          </Route>
          <Route path="school">
            <Route path="years" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL], <SchoolYearListPage />)} />
            {/* Tạo năm học = Thiết lập năm học từng bước (Cần 30/10/2026) */}
            <Route path="years/new" element={only([R.PRINCIPAL], <SchoolYearSetupPage />)} />
            <Route path="years/:id/setup" element={only([R.PRINCIPAL], <SchoolYearSetupPage />)} />
            <Route path="years/:id/setup/:step" element={only([R.PRINCIPAL], <SchoolYearSetupPage />)} />
            <Route path="years/:id/edit" element={only([R.PRINCIPAL], <SchoolYearFormPage />)} />
            <Route path="classes" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <AgeGroupsClassesPage />)} />
            <Route path="rooms" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL], <RoomListPage />)} />
            <Route path="staff" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL], <StaffAccountsPage />)} />
            <Route path="placement" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL], <YearPlacementPage />)} />
            <Route path="cutoff" element={only([R.PRINCIPAL], <CutoffSettingPage />)} />
            <Route path="campuses" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL], <CampusListPage />)} />
            <Route path="campuses/new" element={only([R.PRINCIPAL], <CampusFormPage />)} />
            <Route path="campuses/:id" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL], <CampusDetailPage />)} />
            <Route path="campuses/:id/edit" element={only([R.PRINCIPAL], <CampusFormPage />)} />
            <Route path="vice-principals" element={only([R.PRINCIPAL], <VicePrincipalAssignmentPage />)} />
            <Route path="roles" element={only([R.PRINCIPAL], <RoleDefaultsPage />)} />
            <Route path="roles/:role" element={only([R.PRINCIPAL], <Navigate to="/school/roles" replace />)} />
            <Route
              path="teachers"
              element={
                <RoleGuard
                  allow={canOpenTeacherAssignment}
                  description="Bạn chưa được giao quyền phân công giáo viên hoặc phân công tổ trưởng nhóm tuổi."
                >
                  <TeacherAssignmentPage />
                </RoleGuard>
              }
            />
          </Route>
          <Route path="permissions">
            <Route index element={only([R.PRINCIPAL], <RoleDefaultsPage />)} />
            <Route path="roles" element={only([R.PRINCIPAL], <Navigate to="/school/roles" replace />)} />
            <Route path="overrides" element={only([R.PRINCIPAL], <UserOverridesPage />)} />
            <Route path="history" element={only([R.PRINCIPAL], <PermissionHistoryPage />)} />
          </Route>
          <Route path="children">
            <Route index element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <ChildrenListPage />)} />
            {/* Tiếp nhận, nhập Excel, xếp lớp: Hiệu trưởng như PHT (user chốt 2026-10-27) */}
            <Route path="new" element={only(LEADERS, <EnrollChildPage />)} />
            <Route path="import" element={only(LEADERS, <ImportChildrenPage />)} />
            <Route path="placement" element={only(LEADERS, <ClassPlacementPage />)} />
            <Route
              path="activation"
              element={
                <RoleGuard allow={canManageParentAccounts} description={DENIED}>
                  <ParentActivationPage />
                </RoleGuard>
              }
            />
            <Route path="health-trends" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <HealthTrendPage />)} />
            <Route path="health-checks" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <HealthCheckListPage />)} />
            {/* Đợt khám, kỳ cân đo: Hiệu trưởng và PHT điểm trường quản lý (user chốt 2026-10-31) */}
            <Route path="health-checks/new" element={only(LEADERS, <HealthCheckFormPage />)} />
            <Route
              path="health-checks/:campaignId"
              element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <HealthCheckDetailPage />)}
            />
            <Route path="health-checks/:campaignId/edit" element={only(LEADERS, <HealthCheckFormPage />)} />
            <Route
              path="health-checks/:campaignId/exam/:childId"
              element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <HealthExamFormPage />)}
            />
            <Route path=":id" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <ChildProfilePage />)} />
            <Route path=":id/edit" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL], <EditChildPage />)} />
            <Route
              path=":id/health-declaration"
              element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <HealthDeclarationPage />)}
            />
            <Route path=":id/health" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <ChildHealthRecordPage />)} />
            <Route path=":id/health/new" element={only(CLASS_STAFF, <HealthMeasurementFormPage />)} />
            <Route path=":id/health/:measurementId/edit" element={only(CLASS_STAFF, <HealthMeasurementFormPage />)} />
          </Route>
          {false}
          <Route path="boarding">
            <Route index element={<Navigate to="today" replace />} />
            <Route path="today" element={only(LEADERS, BOARDING_API ? <BoardingTodayPage /> : <KitchenFlowPage />)} />
          </Route>
          <Route path="menu">
            <Route path="flow" element={BOARDING_API ? <Navigate to="/boarding/today" replace /> : only(LEADERS, <NutritionFlowPage />)} />
            <Route path="setup" element={only(LEADERS, <NutritionSetupPage />)} />
            <Route path="foods" element={only(CATALOG_READERS, <FoodListPage />)} />
            <Route path="foods/new" element={only(CATALOG_EDITORS, <FoodFormPage />)} />
            <Route path="foods/:id" element={only(CATALOG_READERS, <FoodDetailPage />)} />
            <Route path="foods/:id/edit" element={only(CATALOG_EDITORS, <FoodFormPage />)} />
            <Route path="dishes" element={only(CATALOG_READERS, <DishListPage />)} />
            <Route path="dishes/new" element={only(CATALOG_EDITORS, <DishFormPage />)} />
            <Route path="dishes/:id" element={only(CATALOG_READERS, <DishDetailPage />)} />
            <Route path="dishes/:id/edit" element={only(CATALOG_EDITORS, <DishFormPage />)} />
            <Route path="suppliers" element={only(LEADERS, <SupplierListPage />)} />
            {/* Thêm/sửa nhà cung cấp mở bằng modal trên danh sách và trang chi tiết: link cũ về trang tương ứng */}
            <Route path="suppliers/new" element={<Navigate to="/menu/suppliers" replace />} />
            <Route path="suppliers/:id" element={only(LEADERS, <SupplierDetailPage />)} />
            <Route path="suppliers/:id/edit" element={<SupplierRedirect />} />
            {/* Mẫu thực đơn một ngày trên BE (NUT-13) */}
            <Route
              path="templates"
              element={TEMPLATE_API ? only(LEADERS, <MenuTemplateListPage />) : <Navigate to="/menu/menus" replace />}
            />
            <Route
              path="templates/new"
              element={TEMPLATE_API ? only(LEADERS, <MenuTemplateEditorPage />) : <Navigate to="/menu/menus" replace />}
            />
            <Route
              path="templates/:id"
              element={TEMPLATE_API ? only(LEADERS, <MenuTemplateEditorPage />) : <Navigate to="/menu/menus" replace />}
            />
            <Route
              path="statistics"
              element={MEAL_PLAN_API ? only(LEADERS, <MenuStatisticsPage />) : <Navigate to="/menu/weekly" replace />}
            />
            {/* Hiệu trưởng và Phó hiệu trưởng thao tác bán trú trong bản demo; BE vẫn kiểm quyền khi nối API. */}
            <Route path="menus" element={TEMPLATE_API ? <Navigate to="/menu/templates" replace /> : only(LEADERS, <MenuListPage />)} />
            <Route path="menus/new" element={only(LEADERS, <MenuFormPage />)} />
            <Route path="menus/:id" element={only(LEADERS, <MenuDetailPage />)} />
            <Route path="menus/:id/edit" element={only(LEADERS, <MenuFormPage />)} />
            <Route path="allergy-menus" element={only(LEADERS, <AllergyMenuListPage />)} />
            <Route path="allergy-menus/new" element={only(LEADERS, <AllergyMenuFormPage />)} />
            <Route path="allergy-menus/:id" element={only(LEADERS, <AllergyMenuDetailPage />)} />
            <Route path="allergy-menus/:id/edit" element={only(LEADERS, <AllergyMenuFormPage />)} />
            <Route path="ai-suggestion" element={only(LEADERS, <AiMenuSuggestionPage />)} />
            <Route path="weekly" element={only(LEADERS, MEAL_PLAN_API ? <WeeklyPlanPage /> : <WeeklyMenuListPage />)} />
            <Route
              path="weekly/new"
              element={MEAL_PLAN_API ? <Navigate to="/menu/weekly" replace /> : only(LEADERS, <WeeklyMenuFormPage />)}
            />
            <Route path="weekly/:id" element={only(LEADERS, <WeeklyMenuDetailPage />)} />
            <Route
              path="weekly/:id/edit"
              element={MEAL_PLAN_API ? <Navigate to="/menu/weekly" replace /> : only(LEADERS, <WeeklyMenuFormPage />)}
            />
            <Route path="nutrition" element={only(LEADERS, <NutritionBalancePage />)} />
            <Route
              path="plans"
              element={MEAL_PLAN_API ? <Navigate to="/menu/weekly" replace /> : only([R.PRINCIPAL], <MenuPlanListPage />)}
            />
            <Route path="plans/:id" element={only([R.PRINCIPAL], <MenuPlanDetailPage />)} />
          </Route>
          <Route path="kitchen">
            <Route index element={BOARDING_API ? <Navigate to="/boarding/today" replace /> : only(LEADERS, <KitchenFlowPage />)} />
            <Route path="dry-stock" element={only(LEADERS, DRY_STOCK_API ? <DryStockLedgerPage tab="stock" /> : <DryStockPage />)} />
            <Route path="stock-history" element={only(LEADERS, DRY_STOCK_API ? <DryStockLedgerPage tab="history" /> : <DryStockPage />)} />
            <Route
              path="stock-shortfalls"
              element={only(LEADERS, DRY_STOCK_API ? <DryStockLedgerPage tab="shortfalls" /> : <DryStockPage />)}
            />
            <Route path="food-samples" element={only(LEADERS, KITCHEN_RECORDS_API ? <FoodSampleQueuePage /> : <FoodSampleLogPage />)} />
            {KITCHEN_RECORDS_API && <Route path="meal-photos" element={only(LEADERS, <MealPhotosPage />)} />}
            {KITCHEN_RECORDS_API && <Route path="photo-windows" element={only(LEADERS, <MealPhotoWindowsPage />)} />}
            <Route path="forecast" element={only(LEADERS, FRESH_GOODS_API ? <FreshForecastPage /> : <WeeklyForecastPage />)} />
            {FRESH_GOODS_API && <Route path="forecast/new" element={only(LEADERS, <FreshForecastPage mode="new" />)} />}
            {FRESH_GOODS_API && <Route path="forecast/:id" element={only(LEADERS, <FreshForecastPage mode="detail" />)} />}
            <Route path="fresh-receipts" element={only(LEADERS, FRESH_GOODS_API ? <FreshCheckPage /> : <FreshReceiptPage />)} />
            <Route
              path="stock-receipts"
              element={only(STOCK_RECEIPT_ROLES, DRY_STOCK_API ? <DryStockLedgerPage tab="receipts" /> : <StockReceiptListPage />)}
            />
            <Route
              path="stock-receipts/new"
              element={only(STOCK_RECEIPT_ROLES, DRY_STOCK_API ? <StockReceiptEditorPage /> : <StockReceiptFormPage />)}
            />
            {DRY_STOCK_API ? (
              <Route path="stock-receipts/:id" element={only(STOCK_RECEIPT_ROLES, <StockReceiptEditorPage />)} />
            ) : (
              <Route path="stock-receipts/:id/edit" element={only(STOCK_RECEIPT_ROLES, <StockReceiptFormPage />)} />
            )}
            {/* Nhà cung cấp chuyển sang Danh mục (/menu/suppliers): giữ đường dẫn cũ */}
            <Route path="suppliers" element={<Navigate to="/menu/suppliers" replace />} />
            <Route path="suppliers/new" element={<Navigate to="/menu/suppliers" replace />} />
            <Route path="suppliers/:id" element={<SupplierRedirect />} />
            <Route path="suppliers/:id/edit" element={<SupplierRedirect />} />
            <Route path="published-menu" element={only(LEADERS, KITCHEN_RECORDS_API ? <KitchenTodayPage /> : <PublishedMenuPage />)} />
            <Route path="meal-count" element={only(LEADERS, <ConfirmedMealCountPage />)} />
            <Route path="required-quantity" element={only(LEADERS, <RequiredFoodQuantityPage />)} />
            <Route path="missing-food" element={only(LEADERS, <MissingFoodReportPage />)} />
          </Route>
          <Route path="assessment">
            <Route path="daily" element={permit([PERMISSIONS.ASSESSMENT_RECORD], <DailyAssessmentPage />)} />
            <Route path="daily/skills" element={permit([PERMISSIONS.ASSESSMENT_RECORD], <DailyGoalAssessmentPage />)} />
            <Route path="day-unlocks" element={permit([PERMISSIONS.ASSESSMENT_UNLOCK], <AssessmentDayUnlockPage />)} />
            <Route path="overview" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <ClassAssessmentOverviewPage />)} />
            <Route path="quality-report" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <QualityReportPage />)} />
            <Route path="class-ratings" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <ClassRatingsPage />)} />
            <Route path="themes" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <ThemeEvaluationPage />)} />
            <Route path="children" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <ChildDevelopmentListPage />)} />
            <Route path="children/:childId" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <ChildDevelopmentProfilePage />)} />
            <Route path="children/:childId/progress" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <ChildDevelopmentProgressPage />)} />
            <Route path="periodic" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <Navigate to="/assessment/children" replace />)} />
            <Route path="periodic/:id" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <Navigate to="/assessment/children" replace />)} />
            <Route
              path="periodic/:id/ai-draft"
              element={permit([PERMISSIONS.ASSESSMENT_VIEW], <Navigate to="/assessment/children" replace />)}
            />
            <Route path="semester" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <SemesterEvaluationListPage />)} />
            <Route path="semester/:id" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <SemesterEvaluationDetailPage />)} />
            <Route path="semester/:id/ai-draft" element={permit([PERMISSIONS.ASSESSMENT_RECORD], <AiEvaluationDraftPage />)} />
            <Route path="year-end" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <YearEndEvaluationListPage />)} />
            <Route path="year-end/:id" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <YearEndEvaluationDetailPage />)} />
            <Route path="year-end/:id/ai-draft" element={permit([PERMISSIONS.ASSESSMENT_RECORD], <AiEvaluationDraftPage />)} />
            <Route path="tickets" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <GoodBehaviourTicketsPage />)} />
            <Route path="rewards" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <RewardListPage />)} />
            <Route path="rewards/:classId" element={permit([PERMISSIONS.ASSESSMENT_VIEW], <RewardClassPage />)} />
          </Route>
          <Route path="attendance">
            <Route path="day-unlocks" element={permit([PERMISSIONS.ATTENDANCE_UNLOCK], <AttendanceDayUnlockPage />)} />
            <Route index element={permit([PERMISSIONS.ATTENDANCE_RECORD, PERMISSIONS.DAILY_HEALTH_RECORD], <AttendancePage />)} />
            <Route path="summary" element={permit([PERMISSIONS.ATTENDANCE_VIEW], <AttendanceSummaryPage />)} />
            {/* AUTH-20: BGH xem số suất mọi điểm trường; nút xác nhận theo MEAL_COUNT_CONFIRM và cờ BE từng bữa */}
            <Route path="meal-count" element={only(LEADERS, <MealCountPage />)} />
            <Route path="health" element={permit([PERMISSIONS.ATTENDANCE_VIEW], <DailyHealthOverviewPage />)} />
            <Route path="leave-requests" element={permit([PERMISSIONS.ATTENDANCE_VIEW], <LeaveRequestsPage />)} />
          </Route>
          <Route path="pickup">
            <Route index element={permit([PERMISSIONS.PICKUP_RECORD], <PickupListPage />)} />
            <Route path=":childId/verify" element={permit([PERMISSIONS.PICKUP_RECORD], <PickupVerifyPage />)} />
            <Route path="result" element={permit([PERMISSIONS.PICKUP_RECORD], <PickupResultPage />)} />
          </Route>
          <Route path="approvals" element={only([...LEADERS, R.TEAM_LEADER], <PendingApprovalsPage />)} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="notifications/:id" element={<NotificationDetailPage />} />
          <Route path="account/profile" element={<ProfilePage />} />
          <Route path="account/password" element={<ChangePasswordPage />} />
          <Route path="settings/appearance" element={<AppearancePage />} />
          {UiKitPage && <Route path="ui-kit" element={<UiKitPage />} />}
          <Route path="coming-soon/:slug" element={<ComingSoonPage />} />
          {false}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

// Cây route không phụ thuộc state ⇒ đọc lại được để tải trước chunk theo đường dẫn menu
registerRouteTree(() => AppRoutes().props.children);
