import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { yearDefaultDate } from '@/utils/attendance/attendanceTime';
import { useAsync } from '@/hooks/useAsync';
import {
  getAttendanceClasses,
  getAttendanceSummary,
  getClassAttendance,
  getMealCounts,
  getMealHandovers,
} from '@/services/attendance/attendanceService';
import { canViewAttendance, isClassTeacher } from '@/utils/attendance/attendancePermissions';

/**
 * Classes for the attendance screens. `own`: only classes the user teaches (recording, meal session),
 * otherwise every class whose attendance the user may view (summary).
 */
export function useAttendanceClasses({ own = false } = {}) {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const { data, loading, error, reload } = useAsync(() => getAttendanceClasses(user, schoolYear), [user?.id, schoolYear], {
    refreshOnDataChange: true,
  });
  const list = useMemo(
    () =>
      (data || [])
        .filter((c) => (own ? isClassTeacher(c, user) : canViewAttendance(c, user)))
        .sort((a, b) => a.campusId.localeCompare(b.campusId) || a.name.localeCompare(b.name, 'vi')),
    [data, own, user],
  );
  return { classes: list, loading, error, reload };
}

/** `live: false` while the teacher is typing so a background change does not wipe the form. */
export function useClassAttendance(classId, date, { live = true } = {}) {
  const { user } = useAuth();
  const { data, setData, loading, error, reload } = useAsync(() => getClassAttendance(classId, date, user), [classId, date, user?.id], {
    enabled: !!classId && !!date,
    refreshOnDataChange: live,
  });
  return { sheet: data, setSheet: setData, loading: loading && !!classId, error, reload };
}

/** Một lớp (classId) hoặc nhiều lớp trong phạm vi (multi: campusId tùy chọn, rỗng = toàn trường). */
export function useAttendanceSummary({ classId, campusId, multi = false, from, to }) {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const enabled = (!!classId || multi) && !!from && !!to && from <= to;
  const { data, loading, error, reload } = useAsync(
    () => getAttendanceSummary({ classId: classId || undefined, campusId: campusId || undefined, schoolYear, from, to }, user),
    [classId, campusId, multi, from, to, user?.id, schoolYear],
    { enabled, refreshOnDataChange: true },
  );
  return { summary: data, loading: loading && enabled, error, reload };
}

export function useMealCounts(date) {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const { data, loading, error, reload } = useAsync(() => getMealCounts({ date, schoolYear }, user), [date, user?.id, schoolYear], {
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

/** Năm học chọn ở header (Cần chốt 23/10/2026: mọi màn theo năm ở header) và ngày mặc định trong năm đó. */
export function useAttendanceYear() {
  const { schoolYear, schoolYears, yearReadOnly } = useSchoolYear();
  const year = schoolYears.find((o) => o.id === schoolYear) || null;
  return { schoolYear, year, yearReadOnly, defaultDate: yearDefaultDate(year) };
}
