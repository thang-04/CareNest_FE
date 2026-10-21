import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DB_CHANGED_EVENT } from '@/mocks/dbEvents';
import { loadWithHold } from '@/hooks/loadingTiming';
import {
  getAccountsWithOverrides,
  getPermissionCatalog,
  getPermissionChangeLogs,
  getPermissionOverrides,
  getRolePermissions,
  getPermissionStaff,
} from '@/services/account/permissionService';

function usePermissionQuery(loader, deps, { live = true, enabled = true } = {}) {
  const { user } = useAuth();
  const key = JSON.stringify([user?.id, user?.role, ...deps]);
  const active = enabled && user?.role === 'PRINCIPAL';
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const epoch = useRef(0);
  const [state, setState] = useState({ key, data: null, loading: active, error: null });
  const reload = useCallback(
    async ({ silent = false } = {}) => {
      const request = ++epoch.current;
      if (!active) {
        setState({ key, data: null, loading: false, error: null });
        return;
      }
      setState((previous) => ({ key, data: silent && previous.key === key ? previous.data : null, loading: !silent, error: null }));
      try {
        const data = silent ? await loaderRef.current() : await loadWithHold(() => loaderRef.current());
        if (request === epoch.current) setState({ key, data, loading: false, error: null });
        return data;
      } catch (error) {
        if (request === epoch.current) setState({ key, data: null, loading: false, error });
      }
    },
    [key, active],
  );
  useEffect(() => {
    reload();
    return () => {
      epoch.current += 1;
    };
  }, [reload]);
  useEffect(() => {
    if (!live || !active) return undefined;
    const refresh = () => reload({ silent: true });
    window.addEventListener(DB_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(DB_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [live, active, reload]);
  return { ...(state.key === key && active ? state : { data: null, error: null, loading: active }), reload };
}

export function useRolePermissionMatrix({ live = true, enabled = true } = {}) {
  const { user } = useAuth();
  const query = usePermissionQuery(
    async () => {
      const [catalog, roles] = await Promise.all([getPermissionCatalog(user), getRolePermissions(user)]);
      return { catalog, roles };
    },
    [],
    { live, enabled },
  );
  return { ...query, catalog: query.data?.catalog || [], roles: query.data?.roles || [] };
}
export function usePermissionOverrides(id, { live = true } = {}) {
  const { user } = useAuth();
  return usePermissionQuery(() => getPermissionOverrides(id, user), [id], { live, enabled: !!id });
}
export function useAccountsWithOverrides({ live = true } = {}) {
  const { user } = useAuth();
  return usePermissionQuery(() => getAccountsWithOverrides(user), [], { live });
}
export function usePermissionStaff({ enabled = true } = {}) {
  const { user } = useAuth();
  return usePermissionQuery(() => getPermissionStaff(user), [], { enabled });
}
export function usePermissionChangeLogs({ targetRole, targetUserId, page = 0, size = 20 } = {}) {
  const { user } = useAuth();
  return usePermissionQuery(
    () => getPermissionChangeLogs({ targetRole, targetUserId, page, size }, user),
    [targetRole, targetUserId, page, size],
  );
}
