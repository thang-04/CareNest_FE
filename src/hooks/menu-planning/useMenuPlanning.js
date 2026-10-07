import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { byId } from '@/utils/menu-planning/menuCalculations';
import { canManageMenuData } from '@/utils/menu-planning/menuPlanningPermissions';
import {
  getAllergyContext,
  getAllergyMenuById,
  getAllergyMenus,
  getDishById,
  getDishes,
  getFoodById,
  getFoods,
  getMealPriceById,
  getMealPrices,
  getMenuAccess,
  getMenuCatalog,
  getMenuPlans,
  getSampleMenuById,
  getSampleMenus,
  getWeeklyMenuById,
  getWeeklyMenus,
} from '@/services/menu-planning/menuPlanningService';

/** List hook: reloads when filters change and when the mock backend changes. */
const listHook = (loader) =>
  function useList(filters) {
    const { user } = useAuth();
    const key = JSON.stringify(filters || {});
    const { data, loading, error, reload } = useAsync(() => loader(filters || {}, user), [key, user?.id], { refreshOnDataChange: true });
    return { items: data || [], loading, error, reload };
  };

/** Detail hook: live=false on forms so background refreshes never reset what the user typed. */
const itemHook = (loader) =>
  function useItem(id, { live = true } = {}) {
    const { user } = useAuth();
    const { data, loading, error, reload } = useAsync(() => loader(id, user), [id, user?.id], { refreshOnDataChange: live, enabled: !!id });
    return { item: data, loading: !!id && loading, error, reload };
  };

export const useFoods = listHook(getFoods);
export const useFood = itemHook(getFoodById);
export const useDishes = listHook(getDishes);
export const useDish = itemHook(getDishById);
export const useMealPrices = listHook(getMealPrices);
export const useMealPrice = itemHook(getMealPriceById);
export const useSampleMenus = listHook(getSampleMenus);
export const useSampleMenu = itemHook(getSampleMenuById);
export const useAllergyMenus = listHook(getAllergyMenus);
export const useAllergyMenu = itemHook(getAllergyMenuById);
export const useWeeklyMenus = listHook(getWeeklyMenus);
export const useWeeklyMenu = itemHook(getWeeklyMenuById);
export const useMenuPlans = listHook(getMenuPlans);

/** Whether the signed-in user may change menu data (VP with shared school-service assignment). */
export function useMenuAccess() {
  const { user } = useAuth();
  const { data, loading } = useAsync(() => getMenuAccess(user), [user?.id]);
  return { loading, sharedService: !!data?.sharedService, canManage: canManageMenuData(user, data) };
}

/** Foods, dishes, menus and prices with lookup maps, for live nutrition / allergen calculations. */
export function useMenuCatalog({ live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getMenuCatalog(user), [user?.id], { refreshOnDataChange: live });
  const catalog = useMemo(() => {
    const c = data || { foods: [], dishes: [], menus: [], allergyMenus: [], mealPrices: [] };
    return { ...c, foodById: byId(c.foods), dishById: byId(c.dishes), menuById: byId(c.menus) };
  }, [data]);
  return { catalog, loading, error, reload };
}

/** Allergens recorded for children of an age group (counts and classes only). */
export function useAllergyContext(ageGroupId) {
  const { user } = useAuth();
  const { data, loading } = useAsync(() => getAllergyContext(ageGroupId, user), [ageGroupId, user?.id], { refreshOnDataChange: true });
  return { rows: data || [], loading };
}
