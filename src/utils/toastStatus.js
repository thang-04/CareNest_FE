const STATUS_LABELS = { success: 'Thành công', error: 'Thất bại', warning: 'Cảnh báo', info: 'Thông báo' };

/**
 * Nội dung toast: chuỗi, hoặc lỗi đã chuẩn hoá { message, status } (axiosClient / ApiError của mock).
 * status 0 = không kết nối được máy chủ.
 */
export function toastContent(message) {
  if (message && typeof message === 'object') {
    const code = Number.isInteger(message.status) ? message.status : undefined;
    return { text: message.message || '', code };
  }
  return { text: message ?? '', code: undefined };
}

/** Dòng trạng thái đầu toast: luôn nói rõ thành công / thất bại; lỗi có mã thì ghi kèm mã. */
export function toastStatusText(type, code) {
  const label = STATUS_LABELS[type] || STATUS_LABELS.info;
  if (type !== 'error' || code === undefined) return label;
  return `${label} · ${code === 0 ? 'Mất kết nối' : `Mã ${code}`}`;
}
