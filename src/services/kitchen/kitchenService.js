import { USE_MOCK } from '@/config/env';
import { kitchenMockRepository as mock } from '@/services/kitchen/mock/kitchenMockRepository';
import { kitchenApi as api } from '@/services/kitchen/api/kitchenApi';
import { readLegacyKitchenRows } from './mock/legacyDashboardRepository';

/** Facade used by hooks/pages. VITE_USE_MOCK=false switches to Spring Boot. */
const repo = USE_MOCK ? mock : api;

/** Quy trình bếp hôm nay: { mealCount, market, issue, missing, stock, samples } của một cơ sở và ngày. */
export const getKitchenDay = (filters, user) => repo.getKitchenDay(filters, user);
/** Sổ lưu mẫu một ngày: { meals, pendingDestroy, canEdit }. */
export const getFoodSampleLog = (filters, user) => repo.getFoodSampleLog(filters, user);
export const saveFoodSample = (payload, user) => repo.saveFoodSample(payload, user);
export const destroyFoodSample = (payload, user) => repo.destroyFoodSample(payload, user);
export const getFoodCatalog = (user) => repo.getFoodCatalog(user);
/** Kho khô hai cơ sở: { campuses, foods, kpis, transactions }. */
export const getDryStock = (user) => repo.getDryStock(user);
export const getDryStockItem = (filters, user) => repo.getDryStockItem(filters, user);
export const getStockCounts = (filters, user) => repo.getStockCounts(filters, user);
export const createStockCount = (payload, user) => repo.createStockCount(payload, user);
export const saveStockCount = (payload, user) => repo.saveStockCount(payload, user);
export const createStockReceipt = (payload, user) => repo.createStockReceipt(payload, user);
/** Phiếu xuất kho đồ khô của một cơ sở: { issues, today } (today = trạng thái hôm nay khi chưa có phiếu). */
export const getStockIssues = (filters, user) => repo.getStockIssues(filters, user);
export const getStockIssue = async ({ campusId, date }, user) => {
  const view = await getStockIssues({ campusId, from: date, to: date }, user);
  const issue = view.issues.find((row) => row.date === date) || null;
  return { state: issue?.status || view.today?.state || 'WAITING_MEAL_COUNT', issue };
};
export const getPublishedMenu = (filters, user) => repo.getPublishedMenu(filters, user);
export const getConfirmedMealCount = (filters, user) => repo.getConfirmedMealCount(filters, user);
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

export const getMealPreparations = (filters, user) =>
  USE_MOCK ? mock.getLegacyMealPreparations(filters, user) : Promise.reject({ status: 501, message: 'Cần thống nhất contract bếp.' });
export const updateMealPreparation = (payload, user) =>
  USE_MOCK ? mock.updateLegacyMealPreparation(payload, user) : Promise.reject({ status: 501, message: 'Cần thống nhất contract bếp.' });
export const getMissingFoodReports = (filters, user) =>
  USE_MOCK
    ? readLegacyKitchenRows('missingFoodReports', filters, user)
    : Promise.reject({ status: 501, message: 'Cần thống nhất contract bếp.' });
