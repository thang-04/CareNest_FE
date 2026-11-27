export const unwrapResponse = (body) => (body && typeof body === 'object' && 'code' in body && 'data' in body ? body.data : body);

const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT']);

/**
 * Câu tiếng Việt cho lỗi không có thông điệp của BE (proxy trả trang HTML 502/504, hết thời gian chờ, mất mạng).
 * Không bao giờ trả `error.message` của axios ("Request failed with status code 502", "timeout of 15000ms exceeded").
 */
export const fallbackErrorMessage = (error, status = error?.response?.status ?? 0) => {
  if (TIMEOUT_CODES.has(error?.code)) return 'Máy chủ phản hồi quá lâu. Vui lòng thử lại sau ít phút.';
  if (!status) return 'Không thể kết nối máy chủ';
  if (status === 502 || status === 503 || status === 504) {
    return 'Máy chủ đang bận hoặc đang khởi động lại. Vui lòng thử lại sau ít phút.';
  }
  if (status >= 500) return 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
  if (status === 401) return 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này';
  if (status === 404) return 'Không tìm thấy dữ liệu yêu cầu';
  if (status === 413) return 'Tệp gửi lên quá lớn';
  if (status === 429) return 'Có quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.';
  return 'Yêu cầu không thành công. Vui lòng thử lại.';
};

export const normalizeApiError = (error) => {
  if (error?.isApiError || error?.code === 'ERR_CANCELED') return error;
  const status = error.response?.status ?? error.status ?? 0;
  const body = error.response?.data;
  // Thân lỗi proxy là chuỗi HTML ⇒ không có desc; câu tiếng Việt theo status, không dùng error.message của axios
  const desc = body?.desc || body?.message || error.desc;
  const message = desc || fallbackErrorMessage(error, status);
  const normalized = new Error(message);
  normalized.isApiError = true;
  normalized.status = status;
  normalized.desc = desc || message;
  // Mã lỗi nghiệp vụ của BE (ApiCode): phân biệt lỗi theo errorCode, không so desc (câu tiếng Việt)
  normalized.errorCode = body?.errorCode ?? error.errorCode ?? null;
  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    Object.defineProperty(normalized, 'blobErrorBody', { value: body });
  }
  const details = body?.data ?? body?.errors ?? error.details;
  normalized.details = Array.isArray(details)
    ? Object.fromEntries(details.filter((item) => item?.field).map((item) => [item.field, item.message]))
    : details;
  return normalized;
};
