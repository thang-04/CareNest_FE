import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import {
  getCampusDetail,
  getCampusesWithStats,
  getCutoffSetting,
  getRolePermissions,
  getSchoolYearById,
  getSchoolYears,
  getStructure,
  getTeacherAssignments,
  getViceAssignments,
} from '@/services/school-config/schoolConfigService';

/* Read hooks of the school-config module. Pass { live: false } on pages that hold a form being typed. */

export function useSchoolYears({ live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getSchoolYears(user), [user?.id], { refreshOnDataChange: live });
  return { years: data || [], loading, error, reload };
}

export function useSchoolYearItem(id, { live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getSchoolYearById(id, user), [id, user?.id], {
    refreshOnDataChange: live,
    enabled: !!id,
  });
  return { year: data, loading: !!id && loading, error, reload };
}

export function useSchoolStructure(schoolYear, campusId) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getStructure({ schoolYear, campusId }, user), [schoolYear, campusId, user?.id], {
    refreshOnDataChange: true,
    enabled: !!schoolYear,
  });
  return { structure: data, loading, error, reload };
}

export function useCutoffSetting(schoolYear, { live = true } = {}) {
  const { data, loading, error, reload } = useAsync(() => getCutoffSetting(schoolYear), [schoolYear], {
    refreshOnDataChange: live,
    enabled: !!schoolYear,
  });
  return { year: data?.year, setting: data?.setting, loading, error, reload };
}

export function useCampusList(schoolYear) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getCampusesWithStats(schoolYear, user), [schoolYear, user?.id], {
    refreshOnDataChange: true,
  });
  return { campuses: data || [], loading, error, reload };
}

export function useCampusDetail(id, schoolYear) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getCampusDetail(id, schoolYear, user), [id, schoolYear, user?.id], {
    refreshOnDataChange: true,
    enabled: !!id,
  });
  return { detail: data, loading, error, reload };
}

export function useViceAssignments(schoolYear) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getViceAssignments(schoolYear, user), [schoolYear, user?.id], {
    refreshOnDataChange: true,
    enabled: !!schoolYear,
  });
  return { data, loading, error, reload };
}

export function useTeacherAssignments(schoolYear, campusId) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(
    () => getTeacherAssignments({ schoolYear, campusId }, user),
    [schoolYear, campusId, user?.id],
    { refreshOnDataChange: true, enabled: !!schoolYear && !!campusId },
  );
  return { data, loading, error, reload };
}

export function useRolePermissions({ live = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getRolePermissions(user), [user?.id], { refreshOnDataChange: live });
  return { roles: data || [], loading, error, reload };
}
