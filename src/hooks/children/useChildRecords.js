import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { getChildDetail, getChildren, getHealthRecord, getParentAccounts, getPlacementClasses } from '@/services/children/childrenService';

/** Children in the user's scope. filters: { keyword, campusId, classId, status, schoolYear } */
export function useChildRecords(filters = {}) {
  const { user } = useAuth();
  const key = JSON.stringify(filters);
  const { data, loading, error, reload } = useAsync(() => getChildren(filters, user), [key, user?.id], { refreshOnDataChange: true });
  return { children: data || [], loading, error, reload };
}

/** Profile bundle { child, cls, declaration, placements }. live=false on editing pages. */
export function useChildDetail(id, { live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getChildDetail(id, user), [id, user?.id], {
    refreshOnDataChange: live,
    enabled: !!id,
  });
  return { detail: data, loading, error, reload };
}

/** Classes the VP can place children into, with their current number of children. */
export function usePlacementClasses(schoolYear) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getPlacementClasses({ schoolYear }, user), [schoolYear, user?.id], {
    refreshOnDataChange: true,
  });
  return { classes: data || [], loading, error, reload };
}

export function useParentAccounts(filters = {}) {
  const { user } = useAuth();
  const key = JSON.stringify(filters);
  const { data, loading, error, reload } = useAsync(() => getParentAccounts(filters, user), [key, user?.id], { refreshOnDataChange: true });
  return { rows: data || [], loading, error, reload };
}

/** Health record bundle { child, cls, declaration, measurements (newest first) }. */
export function useHealthRecord(childId, { live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getHealthRecord(childId, user), [childId, user?.id], {
    refreshOnDataChange: live,
    enabled: !!childId,
  });
  return { record: data, loading, error, reload };
}
