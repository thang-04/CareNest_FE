import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED endpoints only – the backend contract is not agreed yet (CareNest_BE owns it).
 * Same function names and arguments as the mock repository; the signed-in user comes from the Bearer token.
 */
export const accountApi = {
  requestPasswordReset: (body) => axiosClient.post('/auth/password/forgot', body),
  getOtpRequest: (requestId) => axiosClient.get(`/auth/password/otp/${requestId}`),
  resendOtp: (requestId) => axiosClient.post(`/auth/password/otp/${requestId}/resend`),
  verifyOtp: ({ requestId, otp }) => axiosClient.post(`/auth/password/otp/${requestId}/verify`, { otp }),
  setPasswordWithToken: (body) => axiosClient.post('/auth/password/reset', body),
  changePassword: (body) => axiosClient.put('/me/password', body),
  getProfile: () => axiosClient.get('/me/profile'),
  updateProfile: (patch) => axiosClient.patch('/me/profile', patch),
  getNotification: (id) => axiosClient.get(`/notifications/${id}`),
  demoOtp: () => Promise.resolve(null),
};
