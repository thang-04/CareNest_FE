import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import {
  getHealthCheck,
  getHealthCheckClass,
  getHealthChecks,
  getHealthFollowUp,
  getHealthFollowUps,
} from '@/services/children/healthCheckService';

/** Đợt khám trong phạm vi người dùng. filters: { campusId, status } */
export function useHealthChecks(filters = {}) {
  const { user } = useAuth();
  const key = JSON.stringify(filters);
  const { data, loading, error, reload } = useAsync(() => getHealthChecks(filters, user), [key, user?.id], { refreshOnDataChange: true });
  return { campaigns: data || [], loading, error, reload };
}

/** Chi tiết đợt { campaign, classes, watchList }. live=false ở trang sửa. */
export function useHealthCheck(id, { live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getHealthCheck(id, user), [id, user?.id], {
    refreshOnDataChange: live,
    enabled: !!id,
  });
  return { detail: data, loading, error, reload };
}

/** Danh sách trẻ của một lớp trong đợt { campaign, cls, children, canRecord }. */
export function useHealthCheckClass(id, classId) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getHealthCheckClass(id, classId, user), [id, classId, user?.id], {
    refreshOnDataChange: true,
    enabled: !!id && !!classId,
  });
  return { roster: data, loading, error, reload };
}

/** Phiếu theo dõi trong phạm vi người dùng { items, counts }. filters: { campusId, status } */
export function useHealthFollowUps(filters = {}) {
  const { user } = useAuth();
  const key = JSON.stringify(filters);
  const { data, loading, error, reload } = useAsync(() => getHealthFollowUps(filters, user), [key, user?.id], {
    refreshOnDataChange: true,
  });
  return { followUps: data?.items || [], counts: data?.counts || {}, loading, error, reload };
}

/** Chi tiết phiếu theo dõi (kèm các lần khám liên quan và lịch sử). */
export function useHealthFollowUp(id) {
  const { user } = useAuth();
  const { data, setData, loading, error, reload } = useAsync(() => getHealthFollowUp(id, user), [id, user?.id], {
    refreshOnDataChange: true,
    enabled: !!id,
  });
  return { followUp: data, setFollowUp: setData, loading, error, reload };
}
