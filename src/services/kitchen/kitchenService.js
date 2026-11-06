import { SCHOOL_CONFIG_API, USE_MOCK } from '@/config/env';
import { demoActorOf, isDemoModule, sourceOf } from '@/services/demoSource';
import { kitchenMockRepository as mock } from '@/services/kitchen/mock/kitchenMockRepository';
import { syncBeMealCounts } from '@/services/kitchen/mock/beMealCountBridge';
import { kitchenApi as api } from '@/services/kitchen/api/kitchenApi';
import { confirmedMealCountApi } from '@/services/kitchen/api/confirmedMealCountApi';
import { nutritionCatalogApi } from '@/services/nutritionCatalogApi';
import { canManageSuppliers } from '@/utils/kitchen/kitchenPermissions';
import { hasBePermission } from '@/utils/bePermissions';
import { PERMISSIONS } from '@/models/bePermissions';
import { readLegacyKitchenRows } from './mock/legacyDashboardRepository';

/** Facade used by hooks/pages. Nguồn mock/BE theo INTEGRATION_MODULES (src/config/integrationModules.js). */
const repo = sourceOf('kitchen', mock, api);
// Hàm bếp cũ chưa có trong API đề xuất: chỉ chạy được khi module còn demo
const LEGACY_UNAVAILABLE = { status: 501, message: 'Cần thống nhất contract bếp.' };

// Dev: số suất HT/PHT đã xác nhận lấy từ BE trước khi bếp (mock) tính định lượng
const withBeMealCounts = (load) => async (filters, user) => {
  if (SCHOOL_CONFIG_API && USE_MOCK) await syncBeMealCounts(filters?.date);
  return load(filters, user);
};

/** Quy trình bếp hôm nay: { mealCount, market, issue, missing, stock, samples } của một cơ sở và ngày. */
export const getKitchenDay = withBeMealCounts((filters, user) => repo.getKitchenDay(filters, user));
/** Sổ lưu mẫu một ngày: { meals, pendingDestroy, canEdit }. */
export const getFoodSampleLog = (filters, user) => repo.getFoodSampleLog(filters, user);
export const saveFoodSample = (payload, user) => repo.saveFoodSample(payload, user);
export const destroyFoodSample = (payload, user) => repo.destroyFoodSample(payload, user);
export const getFoodCatalog = (user) => repo.getFoodCatalog(user);
/** Kho khô hai cơ sở: { campuses, foods, kpis, transactions }. */
export const getDryStock = (user) => repo.getDryStock(user);
export const getDryStockItem = (filters, user) => repo.getDryStockItem(filters, user);
export const createStockReceipt = (payload, user) => repo.createStockReceipt(payload, user);
/** Phiếu nhập: danh sách theo cơ sở, chi tiết, lưu nháp hoặc xác nhận nhập ({ id?, confirm, ...phiếu }). */
export const getStockReceipts = (filters, user) => repo.getStockReceipts(filters, user);
export const getStockReceipt = (filters, user) => repo.getStockReceipt(filters, user);
export const saveStockReceipt = (payload, user) => repo.saveStockReceipt(payload, user);
/*
 * NCC thuộc danh mục bán trú (BE /nutrition/suppliers, module nutrition-catalog): danh sách ({ keyword, status }), chi tiết,
 * tạo/sửa ({ id?, ... }), xóa (mock: khi chưa có phiếu; BE: chuyển Ngừng dùng).
 */
const supplierRepo = sourceOf('nutrition-catalog', mock, nutritionCatalogApi);
/** Danh mục NCC dùng BE: mã NCC FE sinh từ id, chưa có số phiếu nhập; có CCCD nhà cung cấp. */
export const suppliersUseApi = () => !isDemoModule('nutrition-catalog');
/** Ẩn/hiện nút sửa NCC: BE theo NUTRITION_MANAGE (HT luôn có, PHT khi được cấp); mock theo vai trò. */
export const canEditSuppliers = (user) =>
  suppliersUseApi() ? hasBePermission(user, PERMISSIONS.NUTRITION_MANAGE) : canManageSuppliers(user);
export const getSuppliers = (filters, user) => supplierRepo.getSuppliers(filters, user);
export const getSupplier = (filters, user) => supplierRepo.getSupplier(filters, user);
export const saveSupplier = (payload, user) => supplierRepo.saveSupplier(payload, user);
export const deleteSupplier = (payload, user) => supplierRepo.deleteSupplier(payload, user);
// Phiếu nhập kho còn demo ⇒ chọn NCC trong dữ liệu mẫu cùng nguồn với phiếu
export const getReceiptSuppliers = (filters, user) => repo.getSuppliers(filters, user);
/** Phiếu xuất kho đồ khô của một cơ sở: { issues, today } (today = trạng thái hôm nay khi chưa có phiếu). */
export const getStockIssues = (filters, user) => repo.getStockIssues(filters, user);
/** Bếp chọn lô cho phiếu chờ chọn lô ({ id, allocations: { [foodId]: [{ lotId, qty }] } }) ⇒ hệ thống ghi xuất. */
export const allocateIssueLots = (payload, user) => repo.allocateIssueLots(payload, user);
export const getStockIssue = async ({ campusId, date }, user) => {
  const view = await getStockIssues({ campusId, from: date, to: date }, user);
  const issue = view.issues.find((row) => row.date === date) || null;
  return { state: issue?.status || view.today?.state || 'WAITING_MEAL_COUNT', issue };
};
export const getPublishedMenu = (filters, user) => repo.getPublishedMenu(filters, user);
// Sổ báo ăn đã xác nhận đã có BE: build nối BE đọc số thật dù các màn bếp khác còn demo
const mealCountRepo = sourceOf('kitchen-meal-count', mock, confirmedMealCountApi);
export const getConfirmedMealCount = withBeMealCounts((filters, user) => mealCountRepo.getConfirmedMealCount(filters, user));
/** Dự trù tuần: { status, days, classes, fresh, dry, changes, pendingChanges, sent, canEdit }. */
export const getWeeklyForecast = (filters, user) => repo.getWeeklyForecast(filters, user);
export const saveWeeklyForecast = (payload, user) => repo.saveWeeklyForecast(payload, user);
export const markWeeklyOrderSent = (filters, user) => repo.markWeeklyOrderSent(filters, user);
export const setSupplierNotified = (payload, user) => repo.setSupplierNotified(payload, user);
/** Kiểm nhận hàng tươi một ngày: { status, lines, counts, canEdit, canReview, canMarkNotified, … }. */
export const getFreshReceipt = (filters, user) => repo.getFreshReceipt(filters, user);
export const saveFreshReceipt = (payload, user) => repo.saveFreshReceipt(payload, user);
export const reviewFreshReceipt = (payload, user) => repo.reviewFreshReceipt(payload, user);
export const setFreshSupplierNotified = (payload, user) => repo.setFreshSupplierNotified(payload, user);

export const getMealPreparations = withBeMealCounts((filters, user) =>
  isDemoModule('kitchen') ? repo.getLegacyMealPreparations(filters, user) : Promise.reject(LEGACY_UNAVAILABLE),
);
export const updateMealPreparation = (payload, user) =>
  isDemoModule('kitchen') ? repo.updateLegacyMealPreparation(payload, user) : Promise.reject(LEGACY_UNAVAILABLE);
export const getMissingFoodReports = (filters, user) =>
  isDemoModule('kitchen') ? readLegacyKitchenRows('missingFoodReports', filters, demoActorOf(user)) : Promise.reject(LEGACY_UNAVAILABLE);
