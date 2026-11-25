import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { yearDefaultDate } from '@/utils/attendance/attendanceTime';
import { useAsync } from '@/hooks/useAsync';
import {
  getAttendanceClasses,
  getAttendanceSummary,
  getClassAttendance,
  getClassMealCount,
  getMealCounts,
  getMealHandovers,
} from '@/services/attendance/attendanceService';
import { canViewAttendance, clipToReadRanges, isClassTeacher, isPastClass } from '@/utils/attendance/attendancePermissions';

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
        // AUTH-03: GV giữ cả lớp cũ (chỉ xem trong các đợt đã dạy), lớp đang dạy xếp trước
        .filter((c) => (own ? isClassTeacher(c, user) || isPastClass(c) : canViewAttendance(c, user)))
        .sort(
          (a, b) =>
            Number(isPastClass(a)) - Number(isPastClass(b)) ||
            String(a.campusId).localeCompare(String(b.campusId)) ||
            a.name.localeCompare(b.name, 'vi'),
        ),
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
export function useAttendanceSummary({ classId, campusId, ageGroupId, multi = false, from, to, readRanges }) {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  // AUTH-03: lớp cũ mà khoảng chọn không giao đợt đã dạy nào ⇒ không gọi API (BE sẽ 403); BE tự cắt khoảng thực tế
  const outsideRanges = !multi && !!readRanges?.length && clipToReadRanges(readRanges, from, to) === null;
  const enabled = (!!classId || multi) && !!from && !!to && from <= to && !outsideRanges;
  const { data, loading, error, reload } = useAsync(
    () =>
      getAttendanceSummary(
        { classId: classId || undefined, campusId: campusId || undefined, ageGroupId: ageGroupId || undefined, schoolYear, from, to },
        user,
      ),
    [classId, campusId, ageGroupId, multi, from, to, user?.id, schoolYear],
    { enabled, refreshOnDataChange: true },
  );
  return { summary: data, loading: loading && enabled, error, reload, outsideRanges };
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

/** Suất ăn từng bữa của lớp trong ngày (thẻ "Suất ăn lớp hôm nay" của giáo viên). */
export function useClassMealCount(classId, date) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getClassMealCount({ classId, date }, user), [classId, date, user?.id], {
    enabled: !!classId && !!date,
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
