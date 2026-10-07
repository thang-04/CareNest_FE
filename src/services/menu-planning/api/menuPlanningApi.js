import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED Spring Boot contract for menu planning (same names / shapes as the mock repository).
 * The user is taken from the bearer token, so the `user` argument is ignored here.
 */
const save = (base, id, payload) => (id ? axiosClient.put(`${base}/${id}`, payload) : axiosClient.post(base, payload));

export const menuPlanningApi = {
  getAccess: () => axiosClient.get('/menu/access'),
  getCatalog: () => axiosClient.get('/menu/catalog'),
  getAllergyContext: (ageGroupId) => axiosClient.get('/menu/allergy-context', { params: { ageGroupId } }),

  listFoods: (filters) => axiosClient.get('/menu/foods', { params: filters }),
  getFood: (id) => axiosClient.get(`/menu/foods/${id}`),
  saveFood: (id, payload) => save('/menu/foods', id, payload),
  deleteFood: (id) => axiosClient.delete(`/menu/foods/${id}`),

  listDishes: (filters) => axiosClient.get('/menu/dishes', { params: filters }),
  getDish: (id) => axiosClient.get(`/menu/dishes/${id}`),
  saveDish: (id, payload) => save('/menu/dishes', id, payload),
  deleteDish: (id) => axiosClient.delete(`/menu/dishes/${id}`),

  listMealPrices: (filters) => axiosClient.get('/menu/meal-prices', { params: filters }),
  getMealPrice: (id) => axiosClient.get(`/menu/meal-prices/${id}`),
  saveMealPrice: (id, payload) => save('/menu/meal-prices', id, payload),
  deleteMealPrice: (id) => axiosClient.delete(`/menu/meal-prices/${id}`),

  listMenus: (filters) => axiosClient.get('/menu/sample-menus', { params: filters }),
  getMenu: (id) => axiosClient.get(`/menu/sample-menus/${id}`),
  saveMenu: (id, payload) => save('/menu/sample-menus', id, payload),
  deleteMenu: (id) => axiosClient.delete(`/menu/sample-menus/${id}`),

  listAllergyMenus: (filters) => axiosClient.get('/menu/allergy-menus', { params: filters }),
  getAllergyMenu: (id) => axiosClient.get(`/menu/allergy-menus/${id}`),
  saveAllergyMenu: (id, payload) => save('/menu/allergy-menus', id, payload),
  deleteAllergyMenu: (id) => axiosClient.delete(`/menu/allergy-menus/${id}`),

  listWeeklyMenus: (filters) => axiosClient.get('/menu/weekly-menus', { params: filters }),
  getWeeklyMenu: (id) => axiosClient.get(`/menu/weekly-menus/${id}`),
  saveWeeklyMenu: (id, payload) => save('/menu/weekly-menus', id, payload),
  saveDayAdjustment: (id, date, meals) => axiosClient.put(`/menu/weekly-menus/${id}/days/${date}`, { meals }),
  publishWeeklyMenu: (id) => axiosClient.post(`/menu/weekly-menus/${id}/publish`),
  createReplacement: (id, reason) => axiosClient.post(`/menu/weekly-menus/${id}/replacements`, { reason }),
  deleteWeeklyMenu: (id) => axiosClient.delete(`/menu/weekly-menus/${id}`),

  generateAiSuggestion: (params) => axiosClient.post('/menu/ai-suggestions', params),
  getAiDraft: (id) => axiosClient.get(`/menu/ai-suggestions/${id}`),
  dismissAiDraft: (id) => axiosClient.post(`/menu/ai-suggestions/${id}/dismiss`),

  getPublishedWeeklyMenu: (campusId, date) => axiosClient.get('/menu/published/weekly', { params: { campusId, date } }),
  getPublishedDailyMenu: (campusId, date) => axiosClient.get('/menu/published/daily', { params: { campusId, date } }),
  listMenuPlans: (filters) => axiosClient.get('/menu/plans', { params: filters }),
};
