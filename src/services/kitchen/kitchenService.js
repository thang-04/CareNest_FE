import { USE_MOCK } from '@/config/env';
import { kitchenMockRepository as mock } from '@/services/kitchen/mock/kitchenMockRepository';
import { kitchenApi as api } from '@/services/kitchen/api/kitchenApi';

/** Facade used by hooks/pages. VITE_USE_MOCK=false switches to Spring Boot. */
const repo = USE_MOCK ? mock : api;

export const getFoodCatalog = (user) => repo.getFoodCatalog(user);
export const getStock = (filters, user) => repo.getStock(filters, user);
export const getStockReceipts = (filters, user) => repo.getStockReceipts(filters, user);
export const createStockReceipt = (payload, user) => repo.createStockReceipt(payload, user);
export const getStockIssue = (filters, user) => repo.getStockIssue(filters, user);
export const approveStockIssue = (filters, user) => repo.approveStockIssue(filters, user);
export const confirmIngredientReceipt = (payload, user) => repo.confirmIngredientReceipt(payload, user);
export const getPublishedMenu = (filters, user) => repo.getPublishedMenu(filters, user);
export const getConfirmedMealCount = (filters, user) => repo.getConfirmedMealCount(filters, user);
export const getRequiredQuantity = (filters, user) => repo.getRequiredQuantity(filters, user);
export const getMissingFoodReports = (filters, user) => repo.getMissingFoodReports(filters, user);
export const submitMissingFoodReport = (payload, user) => repo.submitMissingFoodReport(payload, user);
export const markMissingFoodSupplied = (id, note, user) => repo.markMissingFoodSupplied(id, note, user);
export const getMealPreparations = (filters, user) => repo.getMealPreparations(filters, user);
export const updateMealPreparation = (payload, user) => repo.updateMealPreparation(payload, user);
