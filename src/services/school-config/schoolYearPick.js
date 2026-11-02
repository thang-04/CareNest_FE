// Năm học tự chọn ở header, nhớ theo tab (sessionStorage) để F5 không quay về năm đang hoạt động
const key = (userId) => `cn.schoolYear.${userId}`;

export function readPickedSchoolYear(userId) {
  try {
    return userId == null ? null : sessionStorage.getItem(key(userId));
  } catch {
    return null; // trình duyệt chặn bộ nhớ: dùng năm mặc định
  }
}

export function savePickedSchoolYear(userId, id) {
  try {
    if (userId != null) sessionStorage.setItem(key(userId), String(id));
  } catch {
    /* trình duyệt chặn bộ nhớ: chỉ không nhớ qua F5 */
  }
}
