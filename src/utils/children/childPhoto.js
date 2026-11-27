/*
 * Đường dẫn ảnh trên hồ sơ trẻ. photoUrl BE đã trả (kể cả null = hồ sơ chưa có ảnh) thì dùng đúng giá trị đó; response
 * không kèm trường này thì đọc theo mã trẻ, BE kiểm quyền và trả 404 khi chưa có ảnh (màn hiện chữ viết tắt).
 */
export const childPhotoSource = (child) => {
  if (!child) return null;
  if (child.photoUrl !== undefined) return child.photoUrl;
  const id = String(child.childId ?? child.id ?? '');
  return /^\d+$/.test(id) ? `/children/${id}/photo` : null;
};
