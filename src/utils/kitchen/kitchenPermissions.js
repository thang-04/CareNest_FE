import { ROLES } from '@/models/User';

/*
 * Rights follow SRS 4.4 Permission Matrix (footnotes ¹ VP own campus, ⁵ Kitchen Staff own campus kitchen)
 * and the actors of UC 6.23–6.25, which the matrix does not list.
 * Used by the UI to hide actions and re-checked by the mock repository (403).
 */
const is = (user, ...roles) => !!user && roles.includes(user.role);

export const isKitchenStaff = (user) => is(user, ROLES.KITCHEN_STAFF);
export const isVicePrincipal = (user) => is(user, ROLES.VICE_PRINCIPAL);
export const isPrincipal = (user) => is(user, ROLES.PRINCIPAL);

/** Principal sees every campus; everybody else only the assigned campus. */
export const canAccessCampus = (user, campusId) => !!user && (isPrincipal(user) || user.campusId === campusId);

// Matrix rows "Menu – View" and "Meal count by class – View": Principal Full, VP ¹, Kitchen ⁵.
export const canViewPublishedMenu = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF);
export const canViewMealCount = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF);

// Dự trù & đi chợ theo tuần (S1): HT, PHT, Bếp xem; chỉ PHT của cơ sở sửa dự trù, gửi NCC, đánh dấu đã báo.
export const canViewForecast = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF);
export const canEditForecast = (user, campusId) => isVicePrincipal(user) && canAccessCampus(user, campusId);

// Trang Quy trình bếp hôm nay, Sổ lưu mẫu: HT xem mọi cơ sở, PHT và Bếp xem cơ sở mình. Chỉ Bếp của cơ sở ghi lưu mẫu, hủy mẫu.
export const canViewKitchenDay = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF);
export const canEditFoodSample = (user, campusId) => isKitchenStaff(user) && canAccessCampus(user, campusId);

// Kiểm nhận hàng tươi (S5–S6): bếp cơ sở kiểm và gửi, PHT cơ sở xác nhận; HT xem.
export const canViewFreshReceipt = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF);

// UC 6.23: the campus Vice Principal records receipts.
export const canManageStock = (user) => isVicePrincipal(user);
// Kho khô xem chung hai cơ sở (S4): HT và PHT xem; PHT ghi (nhập, kiểm kê) cho cơ sở BE cho phép — mock: cả hai cơ sở.
export const canViewDryStock = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL);
export const canWriteStock = (user, campusId) => isVicePrincipal(user) && !!campusId;
// Phiếu xuất kho tự sinh lúc chốt suất (S8): HT, PHT, Bếp chỉ xem và in.
export const canViewStockIssue = (user) => is(user, ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF);

/** Roles per route, for the lead to register in AppRoutes. */
export const KITCHEN_ROUTE_ROLES = {
  kitchenDay: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF],
  foodSamples: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF],
  dryStock: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL],
  stockReceipts: [ROLES.VICE_PRINCIPAL],
  stockCounts: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL],
  stockIssues: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF],
  publishedMenu: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF],
  mealCount: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF],
  forecast: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF],
  freshReceipts: [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL, ROLES.KITCHEN_STAFF],
};
