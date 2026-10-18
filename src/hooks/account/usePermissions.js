import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import {
  getAccountsWithOverrides,
  getPermissionCatalog,
  getPermissionChangeLogs,
  getPermissionOverrides,
  getRolePermissions,
} from '@/services/account/permissionService';

/** Danh mục quyền + ma trận của 6 vai trò. Trang đang sửa truyền { live: false }. */
export function useRolePermissionMatrix({ live = true, enabled = true } = {}) {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(
    async () => {
      const [catalog, roles] = await Promise.all([getPermissionCatalog(user), getRolePermissions(user)]);
      return { catalog, roles };
    },
    [user?.id],
    { refreshOnDataChange: live, enabled: !!user && enabled },
  );
  return { catalog: data?.catalog || [], roles: data?.roles || [], loading, error, reload };
}

export function usePermissionOverrides(userId, { live = true } = {}) {
  const { user } = useAuth();
  return useAsync(() => getPermissionOverrides(userId, user), [userId, user?.id], {
    refreshOnDataChange: live,
    enabled: !!user && !!userId,
  });
}

/** Danh sách tất cả tài khoản đang có quyền ngoại lệ. */
export function useAccountsWithOverrides({ live = true } = {}) {
  const { user } = useAuth();
  return useAsync(() => getAccountsWithOverrides(user), [user?.id], {
    refreshOnDataChange: live,
    enabled: !!user,
  });
}

/** Lịch sử phân quyền, phân trang phía BE (page bắt đầu từ 0). */
export function usePermissionChangeLogs({ targetRole, targetUserId, page = 0, size = 20 } = {}) {
  const { user } = useAuth();
  return useAsync(
    () => getPermissionChangeLogs({ targetRole, targetUserId, page, size }, user),
    [targetRole, targetUserId, page, size, user?.id],
    { refreshOnDataChange: true, enabled: !!user },
  );
}
