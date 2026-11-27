// CHD-02: lưu hồ sơ trước để ảnh phụ huynh mới gắn đúng id do BE cấp.
export async function saveProfilePhotos(childId, form, saved, reason, user, api) {
  const uploads = [];
  if (form.photoFile) uploads.push(['photo', () => api.replaceChildPhoto(childId, form.photoFile, reason, user)]);
  form.guardians.forEach((guardian, index) => {
    if (!guardian.photoFile) return;
    const stored =
      saved.guardians?.find((g) => guardian.id && String(g.id) === String(guardian.id)) ||
      saved.guardians?.find((g) => g.idNumber === guardian.idNumber);
    uploads.push([
      `guardians.${index}.photo`,
      () => {
        if (!stored?.id) throw new Error('Không tìm thấy phụ huynh vừa lưu. Tải lại hồ sơ và chọn ảnh lần nữa.');
        return api.replaceGuardianPhoto(childId, stored.id, guardian.photoFile, reason, user);
      },
    ]);
  });
  for (const [field, upload] of uploads) {
    try {
      await upload();
    } catch (error) {
      error.photoField = field;
      error.details = { [field]: error.details?.photo || error.details?.[field] || error.message };
      throw error;
    }
  }
}
