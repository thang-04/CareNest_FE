import { AUTH_USE_MOCK, USE_MOCK } from '@/config/env';
import { accountMockRepository as mock } from '@/services/account/mock/accountMockRepository';
import { normalizeAccountProfile } from '@/services/authProfile';
import { accountApi as api } from '@/services/account/api/accountApi';

const authRepo = AUTH_USE_MOCK ? mock : api;
const businessRepo = USE_MOCK ? mock : api;

export const requestPasswordReset = (body) => authRepo.requestPasswordReset(body);
export const getOtpRequest = (requestId) => authRepo.getOtpRequest(requestId);
export const resendOtp = (requestId) => authRepo.resendOtp(requestId);
export const verifyOtp = (body) => authRepo.verifyOtp(body);
export const setPasswordWithToken = (body) => authRepo.setPasswordWithToken(body);
export const changePassword = (body, user) => authRepo.changePassword(body, user);
export const getProfile = async (user) => {
  if (AUTH_USE_MOCK) return businessRepo.getProfile(user);
  const account = await api.getProfile();
  return { ...normalizeAccountProfile(account), profileEditable: false };
};
export const updateProfile = (patch, user) => (AUTH_USE_MOCK ? businessRepo : api).updateProfile(patch, user);
export const getNotification = (id, user) => businessRepo.getNotification(id, user);

export const IS_OTP_DEMO = AUTH_USE_MOCK;
export const getDemoOtp = (requestId) => (AUTH_USE_MOCK ? mock.demoOtp(requestId) : Promise.resolve(null));
