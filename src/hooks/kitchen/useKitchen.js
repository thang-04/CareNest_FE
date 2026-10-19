import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { isPrincipal } from '@/utils/kitchen/kitchenPermissions';
import { resolveKitchenCampusId } from '@/utils/kitchen/kitchenCampus';
import { DB_CHANGED_EVENT } from '@/mocks/mockDatabase';
import {
  getConfirmedMealCount,
  getFoodCatalog,
  getFoodSampleLog,
  getKitchenDay,
  getFreshReceipt,
  getPublishedMenu,
  getDryStock,
  getDryStockItem,
  getStockIssues,
  getStockCounts,
  getWeeklyForecast,
  getMealPreparations,
} from '@/services/kitchen/kitchenService';

/** Campus shown by a kitchen page: the Principal may pick any campus, everyone else stays on the assigned one. */
export function useKitchenCampus(firstCampusId = '') {
  const { user } = useAuth();
  const [picked, setPicked] = useState(user?.campusId || '');
  const canPick = isPrincipal(user);
  const campusId = resolveKitchenCampusId(user, picked, firstCampusId);
  return { campusId, setCampusId: setPicked, canPick };
}

/* Read hooks refresh silently when the mock backend changes, unless { live: false } (forms being typed in). */
const useKitchenQuery = (loader, deps, { live = true, enabled = true } = {}) => {
  const { user } = useAuth();
  return useAsync(() => loader(user), [user?.id, ...deps], { refreshOnDataChange: live, enabled: enabled && !!user });
};

export const useKitchenDay = (campusId, date) =>
  useKitchenQuery((user) => getKitchenDay({ campusId, date }, user), [campusId, date], { enabled: !!campusId && !!date });

export const useFoodSampleLog = (campusId, date) =>
  useKitchenQuery((user) => getFoodSampleLog({ campusId, date }, user), [campusId, date], { enabled: !!campusId && !!date, live: false });

export const useFoodCatalog = () => {
  const { data, ...rest } = useKitchenQuery((user) => getFoodCatalog(user), [], { live: false });
  return { foods: data || [], ...rest };
};

export const useDryStock = () => useKitchenQuery((user) => getDryStock(user), []);

export const useDryStockItem = (foodId) => useKitchenQuery((user) => getDryStockItem({ foodId }, user), [foodId], { enabled: !!foodId });

export const useStockCounts = (campusId) =>
  useKitchenQuery((user) => getStockCounts({ campusId }, user), [campusId], { enabled: !!campusId, live: false });

export const useStockIssues = (campusId) =>
  useKitchenQuery((user) => getStockIssues({ campusId }, user), [campusId], { enabled: !!campusId });

export const usePublishedMenu = (date, view, campusId) => {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState({ key: '', days: [], loading: true, error: null });
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const key = `${user?.id}|${user?.role}|${user?.campusId}|${campusId}|${date}|${view}`;
  const enabled = !!user && !!date && !!campusId;

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setResult({ key, days: [], loading: true, error: null });
    getPublishedMenu({ date, view, campusId }, user).then(
      (days) => !cancelled && setResult({ key, days, loading: false, error: null }),
      (error) => !cancelled && setResult({ key, days: [], loading: false, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [date, view, campusId, user, version, key, enabled]);

  useEffect(() => {
    window.addEventListener(DB_CHANGED_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(DB_CHANGED_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, [reload]);

  // Không để response cũ đưa danh sách trẻ của campus trước trở lại màn hình.
  return {
    days: enabled && result.key === key ? result.days : [],
    loading: enabled && (result.key !== key || result.loading),
    error: enabled && result.key === key ? result.error : null,
    reload,
  };
};

export const useConfirmedMealCount = (campusId, date) => {
  const { data, ...rest } = useKitchenQuery((user) => getConfirmedMealCount({ campusId, date }, user), [campusId, date], {
    enabled: !!campusId && !!date,
  });
  return { sessions: data || [], ...rest };
};

export const useWeeklyForecast = (campusId, weekStart) =>
  useKitchenQuery((user) => getWeeklyForecast({ campusId, weekStart }, user), [campusId, weekStart], {
    enabled: !!campusId && !!weekStart,
  });

export const useFreshReceipt = (campusId, date, opts) =>
  useKitchenQuery((user) => getFreshReceipt({ campusId, date }, user), [campusId, date], { enabled: !!campusId && !!date, ...opts });

export const useMealPreparations = (campusId, date) => {
  const { data, ...rest } = useKitchenQuery((user) => getMealPreparations({ campusId, date }, user), [campusId, date], {
    enabled: !!campusId && !!date,
  });
  return { sessions: data || [], ...rest };
};
