import { USE_MOCK } from '@/config/env';
import { menuPlanningMockRepository as mock } from '@/services/menu-planning/mock/menuPlanningMockRepository';
import { menuPlanningApi as api } from '@/services/menu-planning/api/menuPlanningApi';

/**
 * Facade of menu planning. Every function takes the signed-in `user` last (the mock checks it,
 * the real API reads the token). Errors: { status, message, details? } (details = field errors).
 */
const repo = USE_MOCK ? mock : api;

/** { sharedService } – whether the Vice Principal holds the shared school-service assignment (GBR-GEN-10). */
export const getMenuAccess = (user) => repo.getAccess(user);
/** { foods, dishes, menus, allergyMenus, mealPrices } for live calculations. */
export const getMenuCatalog = (user) => repo.getCatalog(user);
/** [{ allergen, childCount, classes: [{ classId, className, campusId, ageGroupId, count }] }] – counts only. */
export const getAllergyContext = (ageGroupId, user) => repo.getAllergyContext(ageGroupId, user);

/* Foods (Food[]: see models/menu-planning/menuPlanningConstants.js). filters: { keyword, group, status, allergen } */
export const getFoods = (filters, user) => repo.listFoods(filters, user);
export const getFoodById = (id, user) => repo.getFood(id, user);
export const saveFood = (id, payload, user) => repo.saveFood(id, payload, user);
export const deleteFood = (id, user) => repo.deleteFood(id, user);

/* Dishes. filters: { keyword, type, status, allergen } */
export const getDishes = (filters, user) => repo.listDishes(filters, user);
export const getDishById = (id, user) => repo.getDish(id, user);
export const saveDish = (id, payload, user) => repo.saveDish(id, payload, user);
export const deleteDish = (id, user) => repo.deleteDish(id, user);

/* Meal prices. filters: { ageGroupId } */
export const getMealPrices = (filters, user) => repo.listMealPrices(filters, user);
export const getMealPriceById = (id, user) => repo.getMealPrice(id, user);
export const saveMealPrice = (id, payload, user) => repo.saveMealPrice(id, payload, user);
export const deleteMealPrice = (id, user) => repo.deleteMealPrice(id, user);

/* Sample daily menus. filters: { keyword, ageGroupId, status } */
export const getSampleMenus = (filters, user) => repo.listMenus(filters, user);
export const getSampleMenuById = (id, user) => repo.getMenu(id, user);
export const saveSampleMenu = (id, payload, user) => repo.saveMenu(id, payload, user);
export const deleteSampleMenu = (id, user) => repo.deleteMenu(id, user);

/* Alternative (allergy / diet) menus. filters: { keyword, ageGroupId, baseMenuId, restriction } */
export const getAllergyMenus = (filters, user) => repo.listAllergyMenus(filters, user);
export const getAllergyMenuById = (id, user) => repo.getAllergyMenu(id, user);
export const saveAllergyMenu = (id, payload, user) => repo.saveAllergyMenu(id, payload, user);
export const deleteAllergyMenu = (id, user) => repo.deleteAllergyMenu(id, user);

/* Weekly menus. filters: { ageGroupId, status, from, to, keyword }; Principal / kitchen only get PUBLISHED. */
export const getWeeklyMenus = (filters, user) => repo.listWeeklyMenus(filters, user);
export const getWeeklyMenuById = (id, user) => repo.getWeeklyMenu(id, user);
export const saveWeeklyMenu = (id, payload, user) => repo.saveWeeklyMenu(id, payload, user);
export const saveDayAdjustment = (id, date, meals, user) => repo.saveDayAdjustment(id, date, meals, user);
export const publishWeeklyMenu = (id, user) => repo.publishWeeklyMenu(id, user);
export const createWeeklyReplacement = (id, reason, user) => repo.createReplacement(id, reason, user);
export const deleteWeeklyMenu = (id, user) => repo.deleteWeeklyMenu(id, user);

/* AI suggestion: params { kind: 'WEEKLY'|'DAILY', ageGroupId, weekStart?, avoidAllergens? } → draft for human review. */
export const generateAiSuggestion = (params, user) => repo.generateAiSuggestion(params, user);
export const getAiDraft = (id, user) => repo.getAiDraft(id, user);
export const dismissAiDraft = (id, user) => repo.dismissAiDraft(id, user);

/*
 * Read API for other modules (kitchen-stock) – allowed for Principal, Vice Principal and Kitchen Staff.
 * Menus are school-wide, so campusId does not change the result (kept for the API contract).
 */
/** WeeklyMenu[] with status PUBLISHED for the week containing `date` (one per age group). */
export const getPublishedWeeklyMenu = (campusId, date, user) => repo.getPublishedWeeklyMenu(campusId, date, user);
/** Published menu of one day resolved for the kitchen (dishes, allergens, quantity per child). */
export const getPublishedDailyMenu = (campusId, date, user) => repo.getPublishedDailyMenu(campusId, date, user);

/* Principal: published weekly menus (UC 6.1). filters: { ageGroupId, month: 'yyyy-mm' } */
export const getMenuPlans = (filters, user) => repo.listMenuPlans(filters, user);
