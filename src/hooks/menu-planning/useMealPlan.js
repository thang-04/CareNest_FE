import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { mealPlanApi } from '@/services/mealPlanApi';
import { nutritionCatalogApi } from '@/services/nutritionCatalogApi';

/** Kế hoạch của tuần bắt đầu thứ Hai `weekStart` (tuần chưa lập trả status NONE). */
export const useMealPlan = (weekStart) => {
  const { user } = useAuth();
  return useAsync(() => mealPlanApi.getPlan(weekStart), [user?.id, weekStart], { enabled: !!weekStart && !!user });
};

/** Món đang sử dụng để chọn vào lưới (món Ngừng sử dụng không chọn được). */
export function useActiveDishes() {
  const { user } = useAuth();
  const { data, ...rest } = useAsync(() => nutritionCatalogApi.listDishes({ status: 'ACTIVE' }), [user?.id], { enabled: !!user });
  return { dishes: data || [], ...rest };
}
