import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import {
  getGrowthReport,
  getHealthCheck,
  getHealthCheckClass,
  getHealthChecks,
  getHealthExam,
} from '@/services/children/healthCheckService';

/** Đợt khám trong phạm vi người dùng. filters: { campusId, status, schoolYear } */
export function useHealthChecks(filters = {}) {
  const { user } = useAuth();
  const key = JSON.stringify(filters);
  const { data, loading, error, reload } = useAsync(() => getHealthChecks(filters, user), [key, user?.id], { refreshOnDataChange: true });
  return { campaigns: data || [], loading, error, reload };
}

/** Tổng hợp cân đo mẫu 5.1 của một tháng { month, campuses, preschool, nursery, total }; chưa có tháng thì không gọi. */
export function useGrowthReport({ month, campusId }) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(
    () => getGrowthReport({ month, ...(campusId ? { campusId } : {}) }, user),
    [month, campusId, user?.id],
    { refreshOnDataChange: true, enabled: !!month },
  );
  return { report: data, loading, error, reload };
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

/**
 * Phiếu khám Phụ lục II của 1 trẻ trong đợt { campaign, child, measurement, draft, reference, previous, canEdit, ... }.
 * Không tải lại khi dữ liệu đổi: form đang nhập không bị ghi đè; trang tự cập nhật bằng kết quả trả về sau mỗi lần lưu.
 */
export function useHealthExam(campaignId, childId) {
  const { user } = useAuth();
  const { data, setData, loading, error, reload } = useAsync(
    () => getHealthExam(campaignId, childId, user),
    [campaignId, childId, user?.id],
    {
      enabled: !!campaignId && !!childId,
    },
  );
  return { examView: data, setExamView: setData, loading, error, reload };
}
