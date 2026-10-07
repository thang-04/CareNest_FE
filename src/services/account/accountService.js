import { USE_MOCK } from '@/config/env';
import { accountMockRepository as mock } from '@/services/account/mock/accountMockRepository';
import { accountApi as api } from '@/services/account/api/accountApi';

/** Facade used by hooks/pages. VITE_USE_MOCK=false switches to Spring Boot. */
const repo = USE_MOCK ? mock : api;

export const requestPasswordReset = (body) => repo.requestPasswordReset(body);
export const getOtpRequest = (requestId) => repo.getOtpRequest(requestId);
export const resendOtp = (requestId) => repo.resendOtp(requestId);
export const verifyOtp = (body) => repo.verifyOtp(body);
export const setPasswordWithToken = (body) => repo.setPasswordWithToken(body);
export const changePassword = (body, user) => repo.changePassword(body, user);
export const getProfile = (user) => repo.getProfile(user);
export const updateProfile = (patch, user) => repo.updateProfile(patch, user);
export const getNotification = (id, user) => repo.getNotification(id, user);

/* Mock only: the OTP is shown on screen instead of being emailed (hidden when VITE_USE_MOCK=false). */
export const IS_OTP_DEMO = USE_MOCK;
export const getDemoOtp = (requestId) => (USE_MOCK ? mock.demoOtp(requestId) : Promise.resolve(null));
