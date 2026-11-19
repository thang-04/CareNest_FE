// Mốc hết hạn/gửi lại tính theo đồng hồ máy này từ số giây BE trả: máy lệch giờ so với server vẫn đếm đúng
const toLocalDeadline = (seconds, fallback, receivedAt) =>
  Number.isFinite(seconds) ? new Date(receivedAt + seconds * 1000).toISOString() : fallback;
export const withLocalOtpDeadlines = (request, receivedAt = Date.now()) =>
  request && {
    ...request,
    expiresAt: toLocalDeadline(request.expiresInSeconds, request.expiresAt, receivedAt),
    resendAvailableAt: toLocalDeadline(request.resendInSeconds, request.resendAvailableAt, receivedAt),
  };
