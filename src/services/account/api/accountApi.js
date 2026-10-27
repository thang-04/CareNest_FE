import { axiosClient } from '@/services/http/axiosClient';
import { authGet, authPost, refreshSession } from '@/services/http/authTransport';
import { withAuthOperation, completeAuthOperation } from '@/services/http/authBoundary';
import { UNAUTHORIZED_EVENT } from '@/services/http/tokenStorage';
import { endLocalSession } from '@/services/authService';

export const accountApi = {
  requestPasswordReset: (body) => authPost('/auth/password/forgot', body),
  getOtpRequest: (requestId) => authGet('/auth/password/otp/' + encodeURIComponent(requestId)),
  resendOtp: (requestId) => authPost('/auth/password/otp/' + encodeURIComponent(requestId) + '/resend'),
  verifyOtp: ({ requestId, otp }) => authPost('/auth/password/otp/' + encodeURIComponent(requestId) + '/verify', { otp }),
  setPasswordWithToken: (body) =>
    withAuthOperation('password', async (operation) => {
      const result = await authPost('/auth/password/reset', body);
      endLocalSession({ operation: completeAuthOperation(operation, 'logout') });
      return result;
    }),
  changePassword: (body) =>
    withAuthOperation('password', async (operation) => {
      try {
        await refreshSession({ force: false });
      } catch (error) {
        if (error.status === 401) {
          error.sessionExpired = true;
          endLocalSession({ operation: completeAuthOperation(operation, 'logout') });
          window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
        }
        throw error;
      }
      // PUT401 là sai mật khẩu hiện tại; preflight401 mới là hết phiên.
      const result = await axiosClient.put('/me/password', body, { skipAuthRefresh: true });
      endLocalSession({ operation: completeAuthOperation(operation, 'logout') });
      return result;
    }),
  getProfile: () => axiosClient.get('/accounts/me'),
  updateProfile: () => Promise.reject(new Error('Chức năng cập nhật hồ sơ chưa được hỗ trợ. Vui lòng liên hệ nhà trường.')),
  getNotification: (id) => axiosClient.get('/notifications/' + id),
  demoOtp: () => Promise.resolve(null),
};
