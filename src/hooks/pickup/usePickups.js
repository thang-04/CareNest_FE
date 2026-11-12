import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { getPickupBoard, getPickupChild, getPickupClasses, getPickupResults } from '@/services/pickup/pickupService';

/** Lớp người dùng trả trẻ được, năm học đang hoạt động (user chốt 2026-10-28, Y-1); BE quyết định phạm vi (PCK-01). */
export function usePickupClasses() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getPickupClasses(user), [user?.id], { refreshOnDataChange: true });
  return { classes: data || [], loading, error, reload };
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
