export const unwrapResponse = (body) => (body && typeof body === 'object' && 'code' in body && 'data' in body ? body.data : body);

export const normalizeApiError = (error) => {
  if (error?.isApiError || error?.code === 'ERR_CANCELED') return error;
  const status = error.response?.status ?? error.status ?? 0;
  const body = error.response?.data;
  const desc = body?.desc || body?.message || error.desc;
  const message =
    status === 503
      ? 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.'
      : status === 0
        ? 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.'
        : desc || error.message || 'Yêu cầu không thành công';
  const normalized = new Error(message);
  normalized.isApiError = true;
  normalized.status = status;
  normalized.desc = desc || message;
  // Mã lỗi nghiệp vụ của BE (ApiCode): phân biệt lỗi theo errorCode, không so desc (câu tiếng Việt)
  normalized.errorCode = body?.errorCode ?? error.errorCode ?? null;
  const details = body?.data ?? body?.errors ?? error.details;
  normalized.details = Array.isArray(details)
    ? Object.fromEntries(details.filter((item) => item?.field).map((item) => [item.field, item.message]))
    : details;
  return normalized;
};
