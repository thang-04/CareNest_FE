/**
 * Mã quyền BE (`/accounts/me` → user.bePermissions, ADR-0017) để ẩn/hiện menu, route; BE vẫn kiểm tra mọi thao tác.
 * Chế độ mock không có dữ liệu quyền BE ⇒ không lọc thêm (giữ theo vai trò).
 */
export const hasBePermission = (user, ...codes) =>
  !!user && (!Array.isArray(user.bePermissions) || codes.some((code) => user.bePermissions.includes(code)));

/** Quyền có phạm vi SCHOOL do HT cấp; thiếu trường này được hiểu là phạm vi campus để không mở rộng quyền ngoài ý muốn. */
export const hasSchoolWideBePermission = (user, code) =>
  !!user && Array.isArray(user.beSchoolWidePermissions) && user.beSchoolWidePermissions.includes(code);

/** Điểm trường người dùng đang được phân công (PHT có thể phụ trách nhiều điểm trường: locationIds từ /accounts/me). */
export const inOwnCampus = (user, campusId) =>
  !!user &&
  campusId != null &&
  (Array.isArray(user.locationIds) && user.locationIds.length ? user.locationIds : [user.campusId])
    .filter((id) => id != null)
    .some((id) => String(id) === String(campusId));

/** Phạm vi mã quyền: HT cấp SCHOOL thì mọi điểm trường, còn lại các điểm trường được phân công (AUTH-13). */
export const inBePermissionScope = (user, code, campusId) => hasSchoolWideBePermission(user, code) || inOwnCampus(user, campusId);
