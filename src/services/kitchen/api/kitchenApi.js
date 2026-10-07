import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED endpoints only – the backend contract is not agreed yet (CareNest_BE owns it; the food store scope is OPEN).
 * Same function names and arguments as the mock repository. The user comes from the JWT on the server.
 */
export const kitchenApi = {
  getFoodCatalog: () => axiosClient.get('/kitchen/foods'),
  getStock: ({ campusId }) => axiosClient.get('/kitchen/stock', { params: { campusId } }),
  getStockReceipts: ({ campusId }) => axiosClient.get('/kitchen/stock-receipts', { params: { campusId } }),
  createStockReceipt: (payload) => axiosClient.post('/kitchen/stock-receipts', payload),
  getStockIssue: ({ campusId, date }) => axiosClient.get('/kitchen/stock-issues/daily', { params: { campusId, date } }),
  approveStockIssue: ({ campusId, date }) => axiosClient.post('/kitchen/stock-issues/daily/approve', { campusId, date }),
  confirmIngredientReceipt: ({ campusId, date, items }) => axiosClient.post('/kitchen/ingredient-receipts', { campusId, date, items }),
  getPublishedMenu: ({ date, view }) => axiosClient.get('/kitchen/published-menus', { params: { date, view } }),
  getConfirmedMealCount: ({ campusId, date }) => axiosClient.get('/kitchen/meal-counts', { params: { campusId, date } }),
  getRequiredQuantity: ({ campusId, date, session }) =>
    axiosClient.get('/kitchen/required-quantities', { params: { campusId, date, session } }),
  getMissingFoodReports: ({ campusId, status }) => axiosClient.get('/kitchen/missing-food-reports', { params: { campusId, status } }),
  submitMissingFoodReport: (payload) => axiosClient.post('/kitchen/missing-food-reports', payload),
  markMissingFoodSupplied: (id, note) => axiosClient.post(`/kitchen/missing-food-reports/${id}/supply`, { note }),
  getMealPreparations: ({ campusId, date }) => axiosClient.get('/kitchen/meal-preparations', { params: { campusId, date } }),
  updateMealPreparation: (payload) => axiosClient.put('/kitchen/meal-preparations', payload),
};
