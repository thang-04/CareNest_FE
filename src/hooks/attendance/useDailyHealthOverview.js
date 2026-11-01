import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAsync } from '@/hooks/useAsync';
import { getChildDailyHealthHistory, getDailyHealthOverview } from '@/services/dailyHealthService';

// Gắn khóa bộ lọc vào kết quả để bỏ response cũ khi người dùng đổi ngày/điểm trường/trẻ.
function useKeyedAsync(key, loader, deps, enabled) {
  const { data, loading, error, reload } = useAsync(async () => ({ key, value: await loader() }), deps, {
    enabled,
    refreshOnDataChange: true,
  });
  const current = data?.key === key ? data.value : null;
  return { data: current, loading: enabled && (loading || (!current && !error)), error, reload };
}

/** Tổng hợp sức khỏe trong ngày (Hiệu trưởng: toàn trường hoặc một điểm trường; Phó hiệu trưởng: điểm trường của mình). */
export function useDailyHealthOverview({ date, campusId = '', ageGroupId = '', classId = '' }) {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const key = `${date}|${campusId}|${ageGroupId}|${classId}|${user?.id}|${schoolYear}`;
  const { data, loading, error, reload } = useKeyedAsync(
    key,
    () =>
      getDailyHealthOverview(
        { date, schoolYear, campusId: campusId || undefined, ageGroupId: ageGroupId || undefined, classId: classId || undefined },
        user,
      ),
    [key],
    !!date,
  );
  return { overview: data, loading, error, reload };
}

/** Các lần ghi nhận trong ngày của một trẻ, chỉ xem. */
export function useChildDailyHealthHistory({ childId, date }) {
  const { user } = useAuth();
  const key = `${childId}|${date}|${user?.id}`;
  const { data, loading, error, reload } = useKeyedAsync(
    key,
    () => getChildDailyHealthHistory({ childId, date }, user),
    [key],
    !!childId && !!date,
  );
  return { history: data, loading, error, reload };
}
