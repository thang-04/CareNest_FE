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

/** Nhóm tuổi của trường (id BE) cho bộ chọn của màn thống kê. */
export function useBeAgeGroups() {
  const { user } = useAuth();
  const { data, ...rest } = useAsync(() => mealPlanApi.listAgeGroups(), [user?.id], { enabled: !!user });
  return { ageGroups: data || [], ...rest };
}

/** Thống kê một ngày thực đơn; `query` null ⇒ chưa gọi (chưa đủ nhóm tuổi hoặc món). */
export function useMenuStatistics(query) {
  const { user } = useAuth();
  const key = JSON.stringify(query);
  return useAsync(() => mealPlanApi.getMenuStatistics(query), [user?.id, key], { enabled: !!query && !!user });
}
