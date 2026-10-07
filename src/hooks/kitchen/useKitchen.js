import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { isPrincipal } from '@/utils/kitchen/kitchenPermissions';
import {
  getConfirmedMealCount,
  getFoodCatalog,
  getMealPreparations,
  getMissingFoodReports,
  getPublishedMenu,
  getRequiredQuantity,
  getStock,
  getStockIssue,
  getStockReceipts,
} from '@/services/kitchen/kitchenService';

/** Campus shown by a kitchen page: the Principal may pick any campus, everyone else stays on the assigned one. */
export function useKitchenCampus() {
  const { user } = useAuth();
  const [picked, setPicked] = useState(user?.campusId || '');
  const canPick = isPrincipal(user);
  return { campusId: canPick ? picked : user?.campusId, setCampusId: setPicked, canPick };
}

/* Read hooks refresh silently when the mock backend changes, unless { live: false } (forms being typed in). */
const useKitchenQuery = (loader, deps, { live = true, enabled = true } = {}) => {
  const { user } = useAuth();
  return useAsync(() => loader(user), [user?.id, ...deps], { refreshOnDataChange: live, enabled: enabled && !!user });
};

export const useFoodCatalog = () => {
  const { data, ...rest } = useKitchenQuery((user) => getFoodCatalog(user), [], { live: false });
  return { foods: data || [], ...rest };
};

export const useStock = (campusId) => {
  const { data, ...rest } = useKitchenQuery((user) => getStock({ campusId }, user), [campusId], { enabled: !!campusId });
  return { stock: data || [], ...rest };
};

export const useStockReceipts = (campusId) => {
  const { data, ...rest } = useKitchenQuery((user) => getStockReceipts({ campusId }, user), [campusId], { enabled: !!campusId });
  return { receipts: data || [], ...rest };
};

export const useStockIssue = (campusId, date, opts) =>
  useKitchenQuery((user) => getStockIssue({ campusId, date }, user), [campusId, date], { enabled: !!campusId && !!date, ...opts });

export const usePublishedMenu = (date, view) => {
  const { data, ...rest } = useKitchenQuery((user) => getPublishedMenu({ date, view }, user), [date, view], { enabled: !!date });
  return { days: data || [], ...rest };
};

export const useConfirmedMealCount = (campusId, date) => {
  const { data, ...rest } = useKitchenQuery((user) => getConfirmedMealCount({ campusId, date }, user), [campusId, date], {
    enabled: !!campusId && !!date,
  });
  return { sessions: data || [], ...rest };
};

export const useRequiredQuantity = (campusId, date, session) =>
  useKitchenQuery((user) => getRequiredQuantity({ campusId, date, session }, user), [campusId, date, session], {
    enabled: !!campusId && !!date,
  });

export const useMissingFoodReports = (campusId, status) => {
  const { data, ...rest } = useKitchenQuery((user) => getMissingFoodReports({ campusId, status }, user), [campusId, status], {
    enabled: !!campusId,
  });
  return { reports: data || [], ...rest };
};

export const useMealPreparations = (campusId, date, opts) => {
  const { data, ...rest } = useKitchenQuery((user) => getMealPreparations({ campusId, date }, user), [campusId, date], {
    enabled: !!campusId && !!date,
    ...opts,
  });
  return { sessions: data || [], ...rest };
};
