import { createContext, useCallback, useContext, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAsync } from '@/hooks/useAsync';
import { LoadingState, ErrorState } from '@/components/ui/States';
import { ROLES, ROLE_LABELS } from '@/models/User';
import * as service from '@/services/education-plan/educationPlanService';
import { AGE_GROUPS, CLASSES, toEduYear, fromEduYear } from '@/models/education-plan/educationPlanConstants';

const EducationPlanContext = createContext(null);

const now = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const initialsOf = (name = '') => {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

const titleOf = (u) => {
  if (u.role === ROLES.TEAM_LEADER) {
    const group = AGE_GROUPS.find((g) => g.id === u.ageGroupId);
    return `${ROLE_LABELS[u.role]}${group ? ` ${group.name.split(' (')[0]}` : ''} (toàn trường)`;
  }
  if (u.role === ROLES.TEACHER) {
    const cls = CLASSES.find((c) => c.id === u.classId);
    return cls ? `Giáo viên lớp ${cls.name}` : ROLE_LABELS[u.role];
  }
  return ROLE_LABELS[u.role] || u.role;
};

const TOAST_TYPES = { ok: 'success', err: 'error', warn: 'warning', info: 'info' };

const upsert = (list, item) => {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...list];
  const next = list.slice();
  next[i] = item;
  return next;
};

/**
 * Loads goals, theme plans and lesson plans once for every education-plan page and exposes
 * save/delete actions. Writes update the screen right away, then go to the service.
 */
export function EducationPlanProvider({ children }) {
  const { user: authUser } = useAuth();
  const toastApi = useToast();
  const { schoolYear: yearId, setSchoolYear, schoolYears } = useSchoolYear();
  const { data, setData, loading, error, reload } = useAsync(() => service.getEducationPlans(), [], { refreshOnDataChange: true });

  const toast = useCallback((message, tone = 'ok') => toastApi[TOAST_TYPES[tone] || 'success'](message), [toastApi]);

  const user = useMemo(
    () => ({
      id: authUser.id,
      role: authUser.role,
      name: authUser.fullName,
      title: titleOf(authUser),
      initials: initialsOf(authUser.fullName),
      ageGroupId: authUser.ageGroupId,
      classId: authUser.classId,
    }),
    [authUser],
  );

  const value = useMemo(() => {
    const write = (key, call, apply) => async (arg) => {
      setData((prev) => (prev ? { ...prev, [key]: apply(prev[key], arg) } : prev));
      try {
        await call(arg);
      } catch (err) {
        toastApi.error(err.message, 'Không lưu được');
        reload({ silent: true });
      }
    };
    const saveIn = (key, call) => write(key, call, upsert);
    const deleteIn = (key, call) => write(key, call, (list, id) => list.filter((x) => x.id !== id));

    return {
      goals: data?.goals || [],
      themes: data?.themes || [],
      lessons: data?.lessons || [],
      role: user.role,
      user,
      toast,
      schoolYear: toEduYear(yearId),
      schoolYears: schoolYears.map((y) => toEduYear(y.id)),
      setYear: (label) => setSchoolYear(fromEduYear(label)),
      historyEntry: (action, extra = {}) => ({ action, by: user.name, role: ROLE_LABELS[user.role], at: now(), tone: '', ...extra }),
      saveGoal: saveIn('goals', service.saveGoal),
      deleteGoal: deleteIn('goals', service.deleteGoal),
      saveTheme: saveIn('themes', service.saveTheme),
      deleteTheme: deleteIn('themes', service.deleteTheme),
      saveLesson: saveIn('lessons', service.saveLesson),
      deleteLesson: deleteIn('lessons', service.deleteLesson),
    };
  }, [data, setData, reload, user, toast, toastApi, yearId, schoolYears, setSchoolYear]);

  if (loading && !data) return <LoadingState />;
  if (error && !data) return <ErrorState error={error} onRetry={reload} />;
  return <EducationPlanContext.Provider value={value}>{children}</EducationPlanContext.Provider>;
}

/** Data and actions of the education-plan module. Only valid inside EducationPlanProvider. */
export const useEducationPlan = () => useContext(EducationPlanContext);
