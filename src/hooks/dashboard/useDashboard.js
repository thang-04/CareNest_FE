import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAsync } from '@/hooks/useAsync';
import { getPendingApprovals } from '@/services/dashboard/dashboardService';
import { canViewPendingApprovals } from '@/utils/dashboard/dashboardPermissions';
import { todayInput } from '@/utils/format';

/**
 * One dashboard widget = one independent loader, so a failing service only breaks its own card.
 * `loader(user)` must call a service facade; it reloads silently when the data changes elsewhere.
 */
export function useWidget(loader, deps = [], { enabled = true } = {}) {
  const { user } = useAuth();
  return useAsync(() => loader(user), [user?.id, ...deps], { refreshOnDataChange: true, enabled: enabled && !!user });
}

/** Pending approval groups of the signed-in user (#126). `total` counts only the groups that loaded. */
export function usePendingApprovals() {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const enabled = canViewPendingApprovals(user);
  const { data, loading, error, reload } = useAsync(
    () => getPendingApprovals(user, { schoolYear, date: todayInput() }),
    [user?.id, schoolYear],
    {
      refreshOnDataChange: true,
      enabled,
    },
  );
  const groups = data || [];
  return {
    groups,
    total: groups.reduce((n, g) => n + g.items.length, 0),
    failed: groups.filter((g) => g.error),
    loading: enabled && loading,
    error,
    reload,
  };
}
