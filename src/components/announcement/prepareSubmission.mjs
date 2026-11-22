export function validateAnnouncementFiles(files, keepIds = []) {
  if (files.length + keepIds.length > 5) throw new Error('Tối đa 5 tệp đính kèm.');
  if (files.some((file) => file.size > 10 * 1024 * 1024 || !/\.(jpe?g|png|pdf)$/i.test(file.name))) {
    throw new Error('Tệp phải là JPG, PNG hoặc PDF và không quá 10 MB.');
  }
}

export async function prepareAnnouncementSubmission({ title, body, target, sendAt, keepIds, files }, coordinator) {
  if (!target.roles.length) throw new Error('Hãy chọn ít nhất một vai trò nhận thông báo.');
  validateAnnouncementFiles(files, keepIds);
  const instant = sendAt ? new Date(`${sendAt}:00+07:00`) : null;
  if (instant && Number.isNaN(instant.getTime())) throw new Error('Giờ gửi không hợp lệ.');

  // Kiểm tra mới trước xác nhận; không dùng số người nhận cũ để cho phép gửi.
  const preview = await coordinator.run(target);
  if (!preview) return null;
  if (!preview.total) throw new Error('Không có người nhận phù hợp. Hãy kiểm tra lại phạm vi và vai trò đã chọn.');
  return {
    preview,
    data: { title, body, target, sendAt: instant?.toISOString() || null, keepAttachmentIds: keepIds },
  };
}
