import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { getInspectionById, getInspections } from '@/services/inventory-inspection/inspectionService';

export function useInspections(filters) {
  const { user } = useAuth();
  const key = JSON.stringify(filters || {});
  const { data, loading, error, reload } = useAsync(() => getInspections(filters, user), [key, user?.id], { refreshOnDataChange: true });
  return { rounds: data || [], loading, error, reload };
}

/** live=false on editing pages so background refreshes never reset typed counts. */
export function useInspection(id, { live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getInspectionById(id, user), [id, user?.id], {
    refreshOnDataChange: live,
    enabled: !!id,
  });
  return { round: data, loading, error, reload };
}

// Shared with other modules: '@/hooks/useLockedLocations'
export { useLockedLocations } from '@/hooks/useLockedLocations';
