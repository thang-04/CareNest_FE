/**
 * Mã quyền BE (`/accounts/me` → user.bePermissions, ADR-0017) để ẩn/hiện menu, route; BE vẫn kiểm tra mọi thao tác.
 * Chế độ mock không có dữ liệu quyền BE ⇒ không lọc thêm (giữ theo vai trò).
 */
export const hasBePermission = (user, ...codes) =>
  !!user && (!Array.isArray(user.bePermissions) || codes.some((code) => user.bePermissions.includes(code)));
