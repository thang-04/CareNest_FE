import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { RoleGuard } from './RoleGuard';
import { ProtectedRoute, GuestRoute } from './ProtectedRoute';
import { LoadingState } from '@/components/ui/States';
import { ROLES } from '@/models/User';
import HomePage from '@/pages/HomePage';
import ComingSoonPage from '@/pages/ComingSoonPage';
import NotificationsPage from '@/pages/NotificationsPage';
import NotFoundPage from '@/pages/NotFoundPage';

const UiKitPage = lazy(() => import('@/pages/UiKitPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/account/ForgotPasswordPage'));
const VerifyOtpPage = lazy(() => import('@/pages/account/VerifyOtpPage'));
const ResetPasswordPage = lazy(() => import('@/pages/account/ResetPasswordPage'));
const ProfilePage = lazy(() => import('@/pages/account/ProfilePage'));
const ChangePasswordPage = lazy(() => import('@/pages/account/ChangePasswordPage'));
const NotificationDetailPage = lazy(() => import('@/pages/account/NotificationDetailPage'));

/** Public page for signed-out users only (login, password recovery). */
const guest = (page) => (
  <GuestRoute>
    <Suspense fallback={<LoadingState />}>{page}</Suspense>
  </GuestRoute>
);

const TransferListPage = lazy(() => import('@/pages/facility-transfer/TransferListPage'));
const CreateTransferPage = lazy(() => import('@/pages/facility-transfer/CreateTransferPage'));
const TransferDetailPage = lazy(() => import('@/pages/facility-transfer/TransferDetailPage'));
const TransferAdjustmentPage = lazy(() => import('@/pages/facility-transfer/TransferAdjustmentPage'));
const HandoverPage = lazy(() => import('@/pages/facility-transfer/HandoverPage'));
const ReceivePage = lazy(() => import('@/pages/facility-transfer/ReceivePage'));
const TransferDiscrepancyPage = lazy(() => import('@/pages/facility-transfer/TransferDiscrepancyPage'));
const TransferPrintPage = lazy(() => import('@/pages/facility-transfer/TransferPrintPage'));

const InspectionListPage = lazy(() => import('@/pages/inventory-inspection/InspectionListPage'));
const CreateInspectionPage = lazy(() => import('@/pages/inventory-inspection/CreateInspectionPage'));
const InspectionRoundDetailPage = lazy(() => import('@/pages/inventory-inspection/InspectionRoundDetailPage'));
const InspectionSheetPage = lazy(() => import('@/pages/inventory-inspection/InspectionSheetPage'));
const InspectionPrintPage = lazy(() => import('@/pages/inventory-inspection/InspectionPrintPage'));

const EducationPlanLayout = lazy(() => import('@/components/education-plan/EducationPlanLayout'));
const EducationHomeRedirect = lazy(() => import('@/pages/education-plan/EducationHomeRedirect'));
const GoalListPage = lazy(() => import('@/pages/education-plan/GoalListPage'));
const GoalFormPage = lazy(() => import('@/pages/education-plan/GoalFormPage'));
const GoalDetailPage = lazy(() => import('@/pages/education-plan/GoalDetailPage'));
const ThemeListPage = lazy(() => import('@/pages/education-plan/ThemeListPage'));
const ThemeFormPage = lazy(() => import('@/pages/education-plan/ThemeFormPage'));
const ThemeDetailPage = lazy(() => import('@/pages/education-plan/ThemeDetailPage'));
const GoalsThemesPage = lazy(() => import('@/pages/education-plan/GoalsThemesPage'));
const LessonListPage = lazy(() => import('@/pages/education-plan/LessonListPage'));
const LessonFormPage = lazy(() => import('@/pages/education-plan/LessonFormPage'));
const LessonDetailPage = lazy(() => import('@/pages/education-plan/LessonDetailPage'));
const ReviewListPage = lazy(() => import('@/pages/education-plan/ReviewListPage'));
const PlanReviewPage = lazy(() => import('@/pages/education-plan/PlanReviewPage'));
const ApprovalListPage = lazy(() => import('@/pages/education-plan/ApprovalListPage'));
const SchoolPlansPage = lazy(() => import('@/pages/education-plan/SchoolPlansPage'));

const AttendancePage = lazy(() => import('@/pages/attendance/AttendancePage'));
const MealSessionPage = lazy(() => import('@/pages/attendance/MealSessionPage'));
const AttendanceSummaryPage = lazy(() => import('@/pages/attendance/AttendanceSummaryPage'));
const MealCountPage = lazy(() => import('@/pages/attendance/MealCountPage'));
const MealHandoverPage = lazy(() => import('@/pages/attendance/MealHandoverPage'));
const PickupListPage = lazy(() => import('@/pages/pickup/PickupListPage'));
const PickupVerifyPage = lazy(() => import('@/pages/pickup/PickupVerifyPage'));
const PickupResultPage = lazy(() => import('@/pages/pickup/PickupResultPage'));

const SchoolYearListPage = lazy(() => import('@/pages/school-config/SchoolYearListPage'));
const SchoolYearFormPage = lazy(() => import('@/pages/school-config/SchoolYearFormPage'));
const AgeGroupsClassesPage = lazy(() => import('@/pages/school-config/AgeGroupsClassesPage'));
const CutoffSettingPage = lazy(() => import('@/pages/school-config/CutoffSettingPage'));
const CampusListPage = lazy(() => import('@/pages/school-config/CampusListPage'));
const CampusFormPage = lazy(() => import('@/pages/school-config/CampusFormPage'));
const CampusDetailPage = lazy(() => import('@/pages/school-config/CampusDetailPage'));
const VicePrincipalAssignmentPage = lazy(() => import('@/pages/school-config/VicePrincipalAssignmentPage'));
const RolePermissionListPage = lazy(() => import('@/pages/school-config/RolePermissionListPage'));
const RolePermissionFormPage = lazy(() => import('@/pages/school-config/RolePermissionFormPage'));
const TeacherAssignmentPage = lazy(() => import('@/pages/school-config/TeacherAssignmentPage'));

const ChildrenListPage = lazy(() => import('@/pages/children/ChildrenListPage'));
const EnrollChildPage = lazy(() => import('@/pages/children/EnrollChildPage'));
const ImportChildrenPage = lazy(() => import('@/pages/children/ImportChildrenPage'));
const ClassPlacementPage = lazy(() => import('@/pages/children/ClassPlacementPage'));
const ParentActivationPage = lazy(() => import('@/pages/children/ParentActivationPage'));
const ChildProfilePage = lazy(() => import('@/pages/children/ChildProfilePage'));
const EditChildPage = lazy(() => import('@/pages/children/EditChildPage'));
const HealthDeclarationPage = lazy(() => import('@/pages/children/HealthDeclarationPage'));
const ChildHealthRecordPage = lazy(() => import('@/pages/children/ChildHealthRecordPage'));
const HealthMeasurementFormPage = lazy(() => import('@/pages/children/HealthMeasurementFormPage'));
const HealthTrendPage = lazy(() => import('@/pages/children/HealthTrendPage'));

const FacilityAssetListPage = lazy(() => import('@/pages/facility/FacilityAssetListPage'));
const IssueReportPage = lazy(() => import('@/pages/facility/IssueReportPage'));
const RequestFormPage = lazy(() => import('@/pages/facility/RequestFormPage'));
const MyReportsPage = lazy(() => import('@/pages/facility/MyReportsPage'));
const IssueListPage = lazy(() => import('@/pages/facility/IssueListPage'));
const IssueDetailPage = lazy(() => import('@/pages/facility/IssueDetailPage'));
const RequestListPage = lazy(() => import('@/pages/facility/RequestListPage'));
const RequestDetailPage = lazy(() => import('@/pages/facility/RequestDetailPage'));
const ProposalListPage = lazy(() => import('@/pages/facility/ProposalListPage'));
const ProposalFormPage = lazy(() => import('@/pages/facility/ProposalFormPage'));
const ProposalDetailPage = lazy(() => import('@/pages/facility/ProposalDetailPage'));
const StockReceiptListPage = lazy(() => import('@/pages/kitchen/StockReceiptListPage'));
const StockReceiptFormPage = lazy(() => import('@/pages/kitchen/StockReceiptFormPage'));
const StockIssueApprovalPage = lazy(() => import('@/pages/kitchen/StockIssueApprovalPage'));
const MealPreparationStatusPage = lazy(() => import('@/pages/kitchen/MealPreparationStatusPage'));
const PublishedMenuPage = lazy(() => import('@/pages/kitchen/PublishedMenuPage'));
const ConfirmedMealCountPage = lazy(() => import('@/pages/kitchen/ConfirmedMealCountPage'));
const RequiredFoodQuantityPage = lazy(() => import('@/pages/kitchen/RequiredFoodQuantityPage'));
const IngredientReceiptPage = lazy(() => import('@/pages/kitchen/IngredientReceiptPage'));
const MissingFoodReportPage = lazy(() => import('@/pages/kitchen/MissingFoodReportPage'));
const MealPreparationUpdatePage = lazy(() => import('@/pages/kitchen/MealPreparationUpdatePage'));

const DailyAssessmentPage = lazy(() => import('@/pages/assessment/DailyAssessmentPage'));
const ChildDevelopmentListPage = lazy(() => import('@/pages/assessment/ChildDevelopmentListPage'));
const ChildDevelopmentProfilePage = lazy(() => import('@/pages/assessment/ChildDevelopmentProfilePage'));
const ChildDevelopmentProgressPage = lazy(() => import('@/pages/assessment/ChildDevelopmentProgressPage'));
const PeriodicEvaluationListPage = lazy(() => import('@/pages/assessment/PeriodicEvaluationListPage'));
const PeriodicEvaluationDetailPage = lazy(() => import('@/pages/assessment/PeriodicEvaluationDetailPage'));
const AiEvaluationDraftPage = lazy(() => import('@/pages/assessment/AiEvaluationDraftPage'));
const YearEndEvaluationListPage = lazy(() => import('@/pages/assessment/YearEndEvaluationListPage'));
const YearEndEvaluationDetailPage = lazy(() => import('@/pages/assessment/YearEndEvaluationDetailPage'));
const GoodBehaviourTicketsPage = lazy(() => import('@/pages/assessment/GoodBehaviourTicketsPage'));
const RewardProposalListPage = lazy(() => import('@/pages/assessment/RewardProposalListPage'));
const RewardProposalFormPage = lazy(() => import('@/pages/assessment/RewardProposalFormPage'));
const RewardProposalDetailPage = lazy(() => import('@/pages/assessment/RewardProposalDetailPage'));

const PendingApprovalsPage = lazy(() => import('@/pages/dashboard/PendingApprovalsPage'));

const FoodListPage = lazy(() => import('@/pages/menu-planning/FoodListPage'));
const FoodDetailPage = lazy(() => import('@/pages/menu-planning/FoodDetailPage'));
const FoodFormPage = lazy(() => import('@/pages/menu-planning/FoodFormPage'));
const DishListPage = lazy(() => import('@/pages/menu-planning/DishListPage'));
const DishDetailPage = lazy(() => import('@/pages/menu-planning/DishDetailPage'));
const DishFormPage = lazy(() => import('@/pages/menu-planning/DishFormPage'));
const MealPriceListPage = lazy(() => import('@/pages/menu-planning/MealPriceListPage'));
const MealPriceFormPage = lazy(() => import('@/pages/menu-planning/MealPriceFormPage'));
const MenuListPage = lazy(() => import('@/pages/menu-planning/MenuListPage'));
const MenuDetailPage = lazy(() => import('@/pages/menu-planning/MenuDetailPage'));
const MenuFormPage = lazy(() => import('@/pages/menu-planning/MenuFormPage'));
const AllergyMenuListPage = lazy(() => import('@/pages/menu-planning/AllergyMenuListPage'));
const AllergyMenuDetailPage = lazy(() => import('@/pages/menu-planning/AllergyMenuDetailPage'));
const AllergyMenuFormPage = lazy(() => import('@/pages/menu-planning/AllergyMenuFormPage'));
const AiMenuSuggestionPage = lazy(() => import('@/pages/menu-planning/AiMenuSuggestionPage'));
const WeeklyMenuListPage = lazy(() => import('@/pages/menu-planning/WeeklyMenuListPage'));
const WeeklyMenuDetailPage = lazy(() => import('@/pages/menu-planning/WeeklyMenuDetailPage'));
const WeeklyMenuFormPage = lazy(() => import('@/pages/menu-planning/WeeklyMenuFormPage'));
const NutritionBalancePage = lazy(() => import('@/pages/menu-planning/NutritionBalancePage'));
const MenuPlanListPage = lazy(() => import('@/pages/menu-planning/MenuPlanListPage'));
const MenuPlanDetailPage = lazy(() => import('@/pages/menu-planning/MenuPlanDetailPage'));

const VP_ONLY = [ROLES.VICE_PRINCIPAL];
const R = ROLES;
const CLASS_STAFF = [R.TEACHER, R.TEAM_LEADER];
const LEADERS = [R.PRINCIPAL, R.VICE_PRINCIPAL];
const REPORTERS = [...CLASS_STAFF, R.KITCHEN_STAFF];
const ALL_STAFF = [...LEADERS, ...REPORTERS];
const DENIED = 'Chức năng này không thuộc quyền của vai trò hiện tại (theo ma trận phân quyền của hệ thống).';

/** Route element limited to the roles allowed by the SRS permission matrix. */
const only = (roles, page) => (
  <RoleGuard roles={roles} description={DENIED}>
    {page}
  </RoleGuard>
);
const EDU_VP_TL = [ROLES.VICE_PRINCIPAL, ROLES.TEAM_LEADER];
const EDU_TL = [ROLES.TEAM_LEADER];
const EDU_CLASS = [ROLES.TEAM_LEADER, ROLES.TEACHER];
const EDU_ALL = [ROLES.VICE_PRINCIPAL, ROLES.TEAM_LEADER, ROLES.TEACHER];
// Hiệu trưởng: xem toàn bộ (SRS 4.4 – Lesson plan View: Full), không sửa/duyệt.
const EDU_VIEW = [ROLES.PRINCIPAL, ...EDU_ALL];
const EDU_DENIED =
  'Chức năng này dành cho Hiệu trưởng (chỉ xem), Phó hiệu trưởng, tổ trưởng nhóm tuổi hoặc giáo viên theo từng bước của kế hoạch giáo dục.';

/** Route element guarded for education-plan roles. */
const edu = (roles, page) => (
  <RoleGuard roles={roles} description={EDU_DENIED}>
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
            <Suspense fallback={<LoadingState />}>
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
          <Route path="facility/transfers">
            <Route index element={<TransferListPage />} />
            <Route
              path="new"
              element={
                <RoleGuard roles={VP_ONLY}>
                  <CreateTransferPage />
                </RoleGuard>
              }
            />
            <Route path=":id" element={<TransferDetailPage />} />
            <Route
              path=":id/edit"
              element={
                <RoleGuard roles={VP_ONLY}>
                  <TransferAdjustmentPage />
                </RoleGuard>
              }
            />
            <Route
              path=":id/discrepancy"
              element={
                <RoleGuard roles={VP_ONLY}>
                  <TransferDiscrepancyPage />
                </RoleGuard>
              }
            />
            <Route path=":id/handover" element={<HandoverPage />} />
            <Route path=":id/receive" element={<ReceivePage />} />
            <Route path=":id/print" element={<TransferPrintPage />} />
          </Route>
          <Route path="facility/inspections">
            <Route index element={<InspectionListPage />} />
            <Route
              path="new"
              element={
                <RoleGuard roles={VP_ONLY}>
                  <CreateInspectionPage />
                </RoleGuard>
              }
            />
            <Route path=":id" element={<InspectionRoundDetailPage />} />
            <Route
              path=":id/edit"
              element={
                <RoleGuard roles={VP_ONLY}>
                  <CreateInspectionPage />
                </RoleGuard>
              }
            />
            <Route path=":id/sheets/:sheetId" element={<InspectionSheetPage />} />
            <Route path=":id/print" element={<InspectionPrintPage />} />
          </Route>
          <Route path="education" element={<EducationPlanLayout />}>
            <Route index element={edu(EDU_VIEW, <EducationHomeRedirect />)} />
            <Route path="school" element={edu([ROLES.PRINCIPAL], <SchoolPlansPage />)} />
            <Route path="goals" element={edu(EDU_VP_TL, <GoalListPage />)} />
            <Route path="goals/new" element={edu(VP_ONLY, <GoalFormPage />)} />
            <Route path="goals/:id" element={edu([ROLES.PRINCIPAL, ...EDU_VP_TL], <GoalDetailPage />)} />
            <Route path="goals/:id/edit" element={edu(VP_ONLY, <GoalFormPage />)} />
            <Route path="themes" element={edu(EDU_TL, <ThemeListPage />)} />
            <Route path="themes/new" element={edu(EDU_TL, <ThemeFormPage />)} />
            <Route path="themes/:id" element={edu(EDU_VIEW, <ThemeDetailPage />)} />
            <Route path="themes/:id/edit" element={edu(EDU_TL, <ThemeFormPage />)} />
            <Route path="overview" element={edu(EDU_CLASS, <GoalsThemesPage />)} />
            <Route path="lessons" element={edu(EDU_CLASS, <LessonListPage />)} />
            <Route path="lessons/new" element={edu(EDU_CLASS, <LessonFormPage />)} />
            <Route path="lessons/:id" element={edu(EDU_VIEW, <LessonDetailPage />)} />
            <Route path="lessons/:id/edit" element={edu(EDU_CLASS, <LessonFormPage />)} />
            <Route path="reviews" element={edu(EDU_TL, <ReviewListPage />)} />
            <Route path="reviews/:id" element={edu(EDU_TL, <PlanReviewPage stage="tl" />)} />
            <Route path="approvals" element={edu(VP_ONLY, <ApprovalListPage />)} />
            <Route path="approvals/:kind/:id" element={edu(VP_ONLY, <PlanReviewPage stage="vp" />)} />
          </Route>
          <Route path="school">
            <Route path="years" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL], <SchoolYearListPage />)} />
            <Route path="years/new" element={only([R.PRINCIPAL], <SchoolYearFormPage />)} />
            <Route path="years/:id/edit" element={only([R.PRINCIPAL], <SchoolYearFormPage />)} />
            <Route path="classes" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <AgeGroupsClassesPage />)} />
            <Route path="cutoff" element={only([R.PRINCIPAL], <CutoffSettingPage />)} />
            <Route path="campuses" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL], <CampusListPage />)} />
            <Route path="campuses/new" element={only([R.PRINCIPAL], <CampusFormPage />)} />
            <Route path="campuses/:id" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL], <CampusDetailPage />)} />
            <Route path="campuses/:id/edit" element={only([R.PRINCIPAL], <CampusFormPage />)} />
            <Route path="vice-principals" element={only([R.PRINCIPAL], <VicePrincipalAssignmentPage />)} />
            <Route path="roles" element={only([R.PRINCIPAL], <RolePermissionListPage />)} />
            <Route path="roles/:role" element={only([R.PRINCIPAL], <RolePermissionFormPage />)} />
            <Route path="teachers" element={only([R.VICE_PRINCIPAL], <TeacherAssignmentPage />)} />
          </Route>
          <Route path="children">
            <Route index element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <ChildrenListPage />)} />
            <Route path="new" element={only(VP_ONLY, <EnrollChildPage />)} />
            <Route path="import" element={only(VP_ONLY, <ImportChildrenPage />)} />
            <Route path="placement" element={only(VP_ONLY, <ClassPlacementPage />)} />
            <Route path="activation" element={only(VP_ONLY, <ParentActivationPage />)} />
            <Route path="health-trends" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <HealthTrendPage />)} />
            <Route path=":id" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <ChildProfilePage />)} />
            <Route path=":id/edit" element={only(VP_ONLY, <EditChildPage />)} />
            <Route
              path=":id/health-declaration"
              element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <HealthDeclarationPage />)}
            />
            <Route path=":id/health" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <ChildHealthRecordPage />)} />
            <Route path=":id/health/new" element={only(CLASS_STAFF, <HealthMeasurementFormPage />)} />
            <Route path=":id/health/:measurementId/edit" element={only(CLASS_STAFF, <HealthMeasurementFormPage />)} />
          </Route>
          <Route path="facility/assets" element={only(ALL_STAFF, <FacilityAssetListPage />)} />
          <Route path="facility/issues">
            <Route index element={only(LEADERS, <IssueListPage />)} />
            <Route path="new" element={only(REPORTERS, <IssueReportPage />)} />
            <Route path=":id" element={only(ALL_STAFF, <IssueDetailPage />)} />
          </Route>
          <Route path="facility/requests">
            <Route index element={only(LEADERS, <RequestListPage />)} />
            <Route path="new" element={only(REPORTERS, <RequestFormPage />)} />
            <Route path=":id" element={only(ALL_STAFF, <RequestDetailPage />)} />
          </Route>
          <Route path="facility/my-reports" element={only(REPORTERS, <MyReportsPage />)} />
          <Route path="facility/proposals">
            <Route index element={only(LEADERS, <ProposalListPage />)} />
            <Route path="new" element={only(VP_ONLY, <ProposalFormPage />)} />
            <Route path=":id" element={only(LEADERS, <ProposalDetailPage />)} />
            <Route path=":id/edit" element={only(VP_ONLY, <ProposalFormPage />)} />
          </Route>
          <Route path="menu">
            <Route path="foods" element={only(VP_ONLY, <FoodListPage />)} />
            <Route path="foods/new" element={only(VP_ONLY, <FoodFormPage />)} />
            <Route path="foods/:id" element={only(VP_ONLY, <FoodDetailPage />)} />
            <Route path="foods/:id/edit" element={only(VP_ONLY, <FoodFormPage />)} />
            <Route path="dishes" element={only(VP_ONLY, <DishListPage />)} />
            <Route path="dishes/new" element={only(VP_ONLY, <DishFormPage />)} />
            <Route path="dishes/:id" element={only(VP_ONLY, <DishDetailPage />)} />
            <Route path="dishes/:id/edit" element={only(VP_ONLY, <DishFormPage />)} />
            <Route path="prices" element={only(VP_ONLY, <MealPriceListPage />)} />
            <Route path="prices/new" element={only(VP_ONLY, <MealPriceFormPage />)} />
            <Route path="prices/:id/edit" element={only(VP_ONLY, <MealPriceFormPage />)} />
            <Route path="menus" element={only(VP_ONLY, <MenuListPage />)} />
            <Route path="menus/new" element={only(VP_ONLY, <MenuFormPage />)} />
            <Route path="menus/:id" element={only(VP_ONLY, <MenuDetailPage />)} />
            <Route path="menus/:id/edit" element={only(VP_ONLY, <MenuFormPage />)} />
            <Route path="allergy-menus" element={only(VP_ONLY, <AllergyMenuListPage />)} />
            <Route path="allergy-menus/new" element={only(VP_ONLY, <AllergyMenuFormPage />)} />
            <Route path="allergy-menus/:id" element={only(VP_ONLY, <AllergyMenuDetailPage />)} />
            <Route path="allergy-menus/:id/edit" element={only(VP_ONLY, <AllergyMenuFormPage />)} />
            <Route path="ai-suggestion" element={only(VP_ONLY, <AiMenuSuggestionPage />)} />
            <Route path="weekly" element={only(VP_ONLY, <WeeklyMenuListPage />)} />
            <Route path="weekly/new" element={only(VP_ONLY, <WeeklyMenuFormPage />)} />
            <Route path="weekly/:id" element={only(VP_ONLY, <WeeklyMenuDetailPage />)} />
            <Route path="weekly/:id/edit" element={only(VP_ONLY, <WeeklyMenuFormPage />)} />
            <Route path="nutrition" element={only(VP_ONLY, <NutritionBalancePage />)} />
            <Route path="plans" element={only([R.PRINCIPAL], <MenuPlanListPage />)} />
            <Route path="plans/:id" element={only([R.PRINCIPAL], <MenuPlanDetailPage />)} />
          </Route>
          <Route path="kitchen">
            <Route path="stock-receipts" element={only(VP_ONLY, <StockReceiptListPage />)} />
            <Route path="stock-receipts/new" element={only(VP_ONLY, <StockReceiptFormPage />)} />
            <Route path="stock-issues" element={only(VP_ONLY, <StockIssueApprovalPage />)} />
            <Route path="preparation" element={only(VP_ONLY, <MealPreparationStatusPage />)} />
            <Route path="preparation/update" element={only([R.KITCHEN_STAFF], <MealPreparationUpdatePage />)} />
            <Route path="published-menu" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, R.KITCHEN_STAFF], <PublishedMenuPage />)} />
            <Route path="meal-count" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, R.KITCHEN_STAFF], <ConfirmedMealCountPage />)} />
            <Route path="required-quantity" element={only([R.VICE_PRINCIPAL, R.KITCHEN_STAFF], <RequiredFoodQuantityPage />)} />
            <Route path="ingredient-receipts" element={only([R.VICE_PRINCIPAL, R.KITCHEN_STAFF], <IngredientReceiptPage />)} />
            <Route path="missing-food" element={only([R.VICE_PRINCIPAL, R.KITCHEN_STAFF], <MissingFoodReportPage />)} />
          </Route>
          <Route path="assessment">
            <Route path="daily" element={only(CLASS_STAFF, <DailyAssessmentPage />)} />
            <Route path="children" element={only([...LEADERS, ...CLASS_STAFF], <ChildDevelopmentListPage />)} />
            <Route path="children/:childId" element={only(CLASS_STAFF, <ChildDevelopmentProfilePage />)} />
            <Route path="children/:childId/progress" element={only(LEADERS, <ChildDevelopmentProgressPage />)} />
            <Route path="periodic" element={only([...LEADERS, ...CLASS_STAFF], <PeriodicEvaluationListPage />)} />
            <Route path="periodic/:id" element={only([...LEADERS, ...CLASS_STAFF], <PeriodicEvaluationDetailPage />)} />
            <Route path="periodic/:id/ai-draft" element={only(CLASS_STAFF, <AiEvaluationDraftPage />)} />
            <Route path="year-end" element={only([...LEADERS, ...CLASS_STAFF], <YearEndEvaluationListPage />)} />
            <Route path="year-end/:id" element={only([...LEADERS, ...CLASS_STAFF], <YearEndEvaluationDetailPage />)} />
            <Route path="year-end/:id/ai-draft" element={only(CLASS_STAFF, <AiEvaluationDraftPage />)} />
            <Route path="tickets" element={only(CLASS_STAFF, <GoodBehaviourTicketsPage />)} />
            <Route path="rewards" element={only([...LEADERS, ...CLASS_STAFF], <RewardProposalListPage />)} />
            <Route path="rewards/new" element={only(CLASS_STAFF, <RewardProposalFormPage />)} />
            <Route path="rewards/:id" element={only([...LEADERS, ...CLASS_STAFF], <RewardProposalDetailPage />)} />
            <Route path="rewards/:id/edit" element={only(CLASS_STAFF, <RewardProposalFormPage />)} />
          </Route>
          <Route path="attendance">
            <Route index element={only(CLASS_STAFF, <AttendancePage />)} />
            <Route path="meals" element={only(CLASS_STAFF, <MealSessionPage />)} />
            <Route path="summary" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, ...CLASS_STAFF], <AttendanceSummaryPage />)} />
            <Route path="meal-count" element={only([R.PRINCIPAL, R.VICE_PRINCIPAL, R.KITCHEN_STAFF], <MealCountPage />)} />
            <Route path="meal-handover" element={only([...CLASS_STAFF, R.KITCHEN_STAFF], <MealHandoverPage />)} />
          </Route>
          <Route path="pickup">
            <Route index element={only(CLASS_STAFF, <PickupListPage />)} />
            <Route path=":childId/verify" element={only(CLASS_STAFF, <PickupVerifyPage />)} />
            <Route path="result" element={only(CLASS_STAFF, <PickupResultPage />)} />
          </Route>
          <Route path="approvals" element={only([...LEADERS, R.TEAM_LEADER], <PendingApprovalsPage />)} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="notifications/:id" element={<NotificationDetailPage />} />
          <Route path="account/profile" element={<ProfilePage />} />
          <Route path="account/password" element={<ChangePasswordPage />} />
          <Route path="ui-kit" element={<UiKitPage />} />
          <Route path="coming-soon/:slug" element={<ComingSoonPage />} />
          <Route path="facility" element={<Navigate to="/facility/transfers" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
