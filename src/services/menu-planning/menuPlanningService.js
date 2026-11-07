import { isDemoModule, sourceOf } from '@/services/demoSource';
import { menuPlanningMockRepository as mock } from '@/services/menu-planning/mock/menuPlanningMockRepository';
import { menuPlanningApi as api } from '@/services/menu-planning/api/menuPlanningApi';
import { nutritionCatalogApi } from '@/services/nutritionCatalogApi';
import { todayInput } from '@/utils/format';

/**
 * Facade of menu planning. Every function takes the signed-in `user` last (the mock checks it,
 * the real API reads the token). Errors: { status, message, details? } (details = field errors).
 */
const repo = sourceOf('menu-planning', mock, api);
// Danh mục thực phẩm, món, thiết lập dinh dưỡng (cấu hình nhóm tuổi) đã có BE (/nutrition/*); thực đơn vẫn theo module menu-planning
const catalogRepo = sourceOf('nutrition-catalog', mock, nutritionCatalogApi);
/** Build nối BE và danh mục dùng BE: quyền sửa theo NUTRITION_MANAGE, không có trạng thái Nháp của món. */
export const catalogUsesApi = () => !isDemoModule('nutrition-catalog');
/** Món trong thực đơn (module menu-planning) cùng nguồn với nơi lưu món ⇒ lưu được định lượng thử từ màn cân đối. */
export const menuDishesSavable = () => isDemoModule('nutrition-catalog') === isDemoModule('menu-planning');

/** { sharedService } – whether the Vice Principal holds the shared school-service assignment (GBR-GEN-10). */
export const getMenuAccess = (user) => repo.getAccess(user);
/**
 * { foods, dishes, menus, allergyMenus, mealPrices, nutritionSetups, norms, pricePerDay? } for live calculations.
 * Danh mục dùng BE ⇒ định mức, bữa, giá/ngày lấy từ cấu hình nhóm tuổi BE đang hiệu lực hôm nay (khớp màn Thiết lập);
 * thực phẩm, món, thực đơn vẫn theo module menu-planning.
 */
export const loadMenuCatalog = async ({ user, menuRepo, catalogApi, usesApi, today }) => {
  if (!usesApi) return menuRepo.getCatalog(user);
  // Hai nguồn độc lập ⇒ tải song song, không chờ nối tiếp trên mạng chậm
  const [catalog, setups] = await Promise.all([menuRepo.getCatalog(user), catalogApi.getEffectiveSetups(today)]);
  return { ...catalog, ...setups };
};
export const getMenuCatalog = (user) =>
  loadMenuCatalog({ user, menuRepo: repo, catalogApi: nutritionCatalogApi, usesApi: catalogUsesApi(), today: todayInput() });
/** Như getMenuCatalog nhưng thực phẩm lấy từ nguồn danh mục (màn thực phẩm, món): id thực phẩm khớp với món đang sửa. */
export const getCatalogLookups = async (user) => {
  if (!catalogUsesApi()) return getMenuCatalog(user);
  const [catalog, foods] = await Promise.all([getMenuCatalog(user), catalogRepo.listFoods({}, user)]);
  // Món của BE không nằm trong dữ liệu mẫu ⇒ không tra món theo id mẫu
  return { ...catalog, foods, dishes: [] };
};
/** [{ allergen, childCount, classes: [{ classId, className, campusId, ageGroupId, count }] }] – counts only. */
export const getAllergyContext = (ageGroupId, user) => repo.getAllergyContext(ageGroupId, user);

/* Foods (Food[]: see models/menu-planning/menuPlanningConstants.js). filters: { keyword, group, status, allergen } */
export const getFoods = (filters, user) => catalogRepo.listFoods(filters, user);
export const getFoodById = (id, user) => catalogRepo.getFood(id, user);
export const saveFood = (id, payload, user) => catalogRepo.saveFood(id, payload, user);
/** Lưu nhiều thực phẩm một lần: [{ key, id?, data }] → { created, updated }; lỗi 422 theo `${key}.${field}`, không ghi dòng nào. */
export const saveFoodsBulk = (items, user) => catalogRepo.saveFoodsBulk(items, user);
export const setFoodFavorite = (id, favorite, user) => catalogRepo.setFoodFavorite(id, favorite, user);
export const deleteFood = (id, user) => catalogRepo.deleteFood(id, user);

/* Dishes. filters: { keyword, type, status, allergen } */
export const getDishes = (filters, user) => catalogRepo.listDishes(filters, user);
export const getDishById = (id, user) => catalogRepo.getDish(id, user);
export const saveDish = (id, payload, user) => catalogRepo.saveDish(id, payload, user);
export const deleteDish = (id, user) => catalogRepo.deleteDish(id, user);

/* Meal prices. filters: { ageGroupId } */
export const getMealPrices = (filters, user) => repo.listMealPrices(filters, user);
export const getMealPriceById = (id, user) => repo.getMealPrice(id, user);
export const saveMealPrice = (id, payload, user) => repo.saveMealPrice(id, payload, user);
export const deleteMealPrice = (id, user) => repo.deleteMealPrice(id, user);

/* Sample daily menus. filters: { keyword, ageGroupId, status } */
/** [{ ageGroupId, enabled, basis, meals: [{ code, name, unitPrice, countAs }], norms, prices }] – một bản ghi mỗi nhóm tuổi. */
export const getNutritionSetups = (user) => catalogRepo.listNutritionSetups(user);
/** { effectiveFrom, reason, basis, groups } – mock: giá mới từ effectiveFrom, định mức ngay; BE: bản cấu hình mới từ effectiveFrom. */
export const saveNutritionSetups = (payload, user) => catalogRepo.saveNutritionSetups(payload, user);

/** Thư viện món tham khảo (chỉ đọc): [{ id, name, type, ingredients: [{ foodName, unit, portions, inCatalog }], kcal, allergens, inCatalog }]. */
export const getReferenceDishes = (filters, user) => repo.listReferenceDishes(filters, user);
/** Chép một món tham khảo về danh mục của trường; thực phẩm còn thiếu được thêm. → { dish, addedFoods } */
export const copyReferenceDish = (id, user) => repo.copyReferenceDish(id, user);

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
/** Áp dụng đề xuất AI sửa một ngày (kind DAY_FIX) vào bản nháp thực đơn tuần. */
export const applyDayFix = (id, weeklyMenuId, user) => repo.applyDayFix(id, weeklyMenuId, user);
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
