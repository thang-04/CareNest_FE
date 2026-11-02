import { axiosClient } from '@/services/http/axiosClient';
import { PERMISSION_TASKS } from '@/models/account/permissionConstants';

/*
 * Contract: BE:src/main/java/com/carenest/controller/account/PermissionController.java (chỉ PRINCIPAL).
 * Cùng tên/tham số với permissionMockRepository; BE đọc người gọi từ JWT nên `user` bị bỏ qua.
 */

// Nhân sự nhận ngoại lệ quyền, giống danh sách của mock
const STAFF_ROLES = ['VICE_PRINCIPAL', 'TEACHER'];
const ACCOUNT_PAGE_SIZE = 100;

// Catalog BE chưa có `feature/action/requires` ⇒ gom dòng theo nhóm hiển thị của FE; quan hệ cần-có để BE kiểm
const toCatalogItem = (permission) => ({
  ...permission,
  feature: permission.feature ?? PERMISSION_TASKS[permission.code]?.group ?? permission.code,
  action: permission.action ?? (permission.code.endsWith('_VIEW') ? 'VIEW' : 'MANAGE'),
  requires: permission.requires ?? [],
});

const listAccounts = async (role) => {
  const items = [];
  for (let page = 0; ; page += 1) {
    const result = await axiosClient.get('/accounts', { params: { role, page, size: ACCOUNT_PAGE_SIZE } });
    items.push(...result.items);
    if (page + 1 >= result.totalPages) return items;
  }
};

const getPermissionOverrides = (userId) => axiosClient.get(`/accounts/${userId}/permission-overrides`);

const getPermissionStaff = async () => {
  const [campuses, ...accounts] = await Promise.all([axiosClient.get('/campuses/options'), ...STAFF_ROLES.map(listAccounts)]);
  const campusName = (assignments = []) =>
    campuses.find((campus) => campus.id === assignments.find((item) => item.campusId != null)?.campusId)?.name || null;
  return {
    items: accounts.flat().map((account) => ({
      userId: account.userId,
      fullName: account.fullName,
      role: account.role,
      // Tài khoản nhân sự đăng nhập bằng SĐT ⇒ username là SĐT
      phone: account.username || '',
      status: account.status,
      campusName: campusName(account.activeAssignments),
    })),
  };
};

export const permissionApi = {
  getPermissionStaff,
  getPermissionCatalog: async () => (await axiosClient.get('/permissions')).map(toCatalogItem),
  getRolePermissions: () => axiosClient.get('/role-permissions'),
  updateRolePermissions: (role, { permissions, reason }) => axiosClient.put(`/role-permissions/${role}`, { permissions, reason }),
  getPermissionOverrides,
  // BE chưa có API liệt kê người có ngoại lệ ⇒ đọc ngoại lệ của từng nhân sự cấu hình được
  getAccountsWithOverrides: async () => {
    const { items } = await getPermissionStaff();
    const views = await Promise.all(items.map(async (staff) => ({ ...(await getPermissionOverrides(staff.userId)), ...staff })));
    return views.filter((view) => view.overrides.length > 0);
  },
  updatePermissionOverrides: async (userId, { overrides, reason }) => {
    // UI chưa chọn phạm vi: giữ scope đang có của ngoại lệ cùng mã, không để BE hạ SCHOOL về CAMPUS mặc định (AUTH-20)
    const current = await getPermissionOverrides(userId);
    const scopeOf = (item) =>
      item.scope ?? current.overrides.find((o) => o.permission === item.permission && o.effect === item.effect)?.scope ?? null;
    return axiosClient.put(`/accounts/${userId}/permission-overrides`, {
      reason,
      overrides: overrides.map((item) => ({ permission: item.permission, effect: item.effect, scope: scopeOf(item) })),
    });
  },
  getPermissionChangeLogs: ({ targetRole, targetUserId, page = 0, size = 20 } = {}) =>
    axiosClient.get('/permission-change-logs', { params: { targetRole, targetUserId, page, size } }),
};
