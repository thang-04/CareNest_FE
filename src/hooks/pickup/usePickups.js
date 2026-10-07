import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useClasses } from '@/hooks/useSchool';
import { getPickupBoard, getPickupChild, getPickupResults } from '@/services/pickup/pickupService';
import { canHandOverChildren } from '@/utils/pickup/pickupPermissions';

/** Classes whose children the user hands over (own classes only). */
export function usePickupClasses() {
  const { user } = useAuth();
  const { classes, loading, error, reload } = useClasses();
  const own = useMemo(() => classes.filter((c) => canHandOverChildren(c, user)), [classes, user]);
  return { classes: own, loading, error, reload };
}

export function usePickupBoard(classId, date) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getPickupBoard({ classId, date }, user), [classId, date, user?.id], {
    enabled: !!classId,
    refreshOnDataChange: true,
  });
  return { board: data, loading: loading && !!classId, error, reload };
}

export function usePickupChild(childId, { live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getPickupChild(childId, user), [childId, user?.id], {
    enabled: !!childId,
    refreshOnDataChange: live,
  });
  return { context: data, loading: loading && !!childId, error, reload };
}

export function usePickupResults(date) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getPickupResults({ date }, user), [date, user?.id], {
    refreshOnDataChange: true,
  });
  return { results: data || [], loading, error, reload };
}
