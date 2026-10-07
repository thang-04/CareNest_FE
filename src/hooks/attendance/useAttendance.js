import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { useClasses } from '@/hooks/useSchool';
import { getAttendanceSummary, getClassAttendance, getMealCounts, getMealHandovers } from '@/services/attendance/attendanceService';
import { canViewAttendance, isClassTeacher } from '@/utils/attendance/attendancePermissions';

/**
 * Classes for the attendance screens. `own`: only classes the user teaches (recording, meal session),
 * otherwise every class whose attendance the user may view (summary).
 */
export function useAttendanceClasses({ own = false } = {}) {
  const { user } = useAuth();
  const { classes, loading, error, reload } = useClasses();
  const list = useMemo(
    () =>
      classes
        .filter((c) => (own ? isClassTeacher(c, user) : canViewAttendance(c, user)))
        .sort((a, b) => a.campusId.localeCompare(b.campusId) || a.name.localeCompare(b.name, 'vi')),
    [classes, own, user],
  );
  return { classes: list, loading, error, reload };
}

/** `live: false` while the teacher is typing so a background change does not wipe the form. */
export function useClassAttendance(classId, date, { live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getClassAttendance(classId, date, user), [classId, date, user?.id], {
    enabled: !!classId && !!date,
    refreshOnDataChange: live,
  });
  return { sheet: data, loading: loading && !!classId, error, reload };
}

export function useAttendanceSummary({ classId, from, to }) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(
    () => getAttendanceSummary({ classId, from, to }, user),
    [classId, from, to, user?.id],
    {
      enabled: !!classId && !!from && !!to && from <= to,
      refreshOnDataChange: true,
    },
  );
  return { summary: data, loading: loading && !!classId, error, reload };
}

export function useMealCounts(date) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getMealCounts({ date }, user), [date, user?.id], {
    enabled: !!date,
    refreshOnDataChange: true,
  });
  return { data, loading, error, reload };
}

export function useMealHandovers(date) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getMealHandovers({ date }, user), [date, user?.id], {
    enabled: !!date,
    refreshOnDataChange: true,
  });
  return { data, loading, error, reload };
}
