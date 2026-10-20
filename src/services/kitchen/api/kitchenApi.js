import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED endpoints only – the backend contract is not agreed yet (CareNest_BE owns it; the food store scope is OPEN).
 * Same function names and arguments as the mock repository. The user comes from the JWT on the server.
 */
export const kitchenApi = {
  getKitchenDay: ({ campusId, date }) => axiosClient.get('/kitchen/day', { params: { campusId, date } }),
  getFoodSampleLog: ({ campusId, date }) => axiosClient.get('/kitchen/food-samples', { params: { campusId, date } }),
  saveFoodSample: ({ campusId, date, session, takenAt, dishes }) =>
    axiosClient.put(`/kitchen/food-samples/${campusId}/${date}/${session}`, { takenAt, dishes }),
  destroyFoodSample: ({ campusId, date, session }) => axiosClient.post(`/kitchen/food-samples/${campusId}/${date}/${session}/destroy`),
  getFoodCatalog: () => axiosClient.get('/kitchen/foods'),
  getDryStock: () => axiosClient.get('/kitchen/dry-stock'),
  getDryStockItem: ({ foodId }) => axiosClient.get(`/kitchen/dry-stock/${foodId}`),
  createStockReceipt: (payload) => axiosClient.post('/kitchen/stock-receipts', { ...payload, confirm: true }),
  getStockReceipts: ({ campusId }) => axiosClient.get('/kitchen/stock-receipts', { params: { campusId } }),
  getStockReceipt: ({ id }) => axiosClient.get(`/kitchen/stock-receipts/${id}`),
  saveStockReceipt: ({ id, ...payload }) =>
    id ? axiosClient.put(`/kitchen/stock-receipts/${id}`, payload) : axiosClient.post('/kitchen/stock-receipts', payload),
  getSuppliers: ({ keyword, status } = {}) => axiosClient.get('/kitchen/suppliers', { params: { keyword, status } }),
  getSupplier: ({ id }) => axiosClient.get(`/kitchen/suppliers/${id}`),
  saveSupplier: ({ id, ...payload }) =>
    id ? axiosClient.put(`/kitchen/suppliers/${id}`, payload) : axiosClient.post('/kitchen/suppliers', payload),
  deleteSupplier: ({ id }) => axiosClient.delete(`/kitchen/suppliers/${id}`),
  getStockIssues: ({ campusId, from, to }) => axiosClient.get('/kitchen/stock-issues', { params: { campusId, from, to } }),
  allocateIssueLots: ({ id, allocations }) => axiosClient.post(`/kitchen/stock-issues/${id}/allocations`, { allocations }),
  getPublishedMenu: ({ date, view }) => axiosClient.get('/kitchen/published-menus', { params: { date, view } }),
  getConfirmedMealCount: ({ campusId, date }) => axiosClient.get('/kitchen/meal-counts', { params: { campusId, date } }),
  getWeeklyForecast: ({ campusId, weekStart }) => axiosClient.get('/kitchen/weekly-forecasts', { params: { campusId, weekStart } }),
  saveWeeklyForecast: ({ campusId, weekStart, cells }) => axiosClient.put('/kitchen/weekly-forecasts', { campusId, weekStart, cells }),
  markWeeklyOrderSent: ({ campusId, weekStart }) => axiosClient.post('/kitchen/weekly-forecasts/sent', { campusId, weekStart }),
  setSupplierNotified: ({ campusId, weekStart, date, foodId, notified }) =>
    axiosClient.put('/kitchen/supplier-changes', { campusId, weekStart, date, foodId, notified }),
  getFreshReceipt: ({ campusId, date }) => axiosClient.get('/kitchen/fresh-receipts', { params: { campusId, date } }),
  saveFreshReceipt: ({ campusId, date, header, lines, submit }) =>
    axiosClient.put('/kitchen/fresh-receipts', { campusId, date, header, lines, submit }),
  reviewFreshReceipt: ({ campusId, date, approve, note }) =>
    axiosClient.post('/kitchen/fresh-receipts/review', { campusId, date, approve, note }),
  setFreshSupplierNotified: ({ campusId, date, foodId, notified }) =>
    axiosClient.put('/kitchen/fresh-receipts/supplier-notified', { campusId, date, foodId, notified }),
};
