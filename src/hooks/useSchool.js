import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { getClasses, getChildren } from '@/services/schoolService';

/** Classes visible to the signed-in user. filters: { campusId, ageGroupId, all } */
export function useClasses(filters = {}) {
  const { user } = useAuth();
  const key = JSON.stringify(filters);
  const { data, loading, error, reload } = useAsync(() => getClasses(filters, user), [key, user?.id], { refreshOnDataChange: true });
  return { classes: data || [], loading, error, reload };
}

/** Children visible to the signed-in user. filters: { classId, campusId, status } */
export function useChildren(filters = {}, { enabled = true } = {}) {
  const { user } = useAuth();
  const key = JSON.stringify(filters);
  const { data, loading, error, reload } = useAsync(() => getChildren(filters, user), [key, user?.id], {
    refreshOnDataChange: true,
    enabled,
  });
  return { children: data || [], loading, error, reload };
}
