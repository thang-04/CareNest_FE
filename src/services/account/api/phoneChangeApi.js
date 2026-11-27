import { axiosClient } from '@/services/http/axiosClient';

const requests = '/parent-accounts/phone-change-requests';
export const phoneChangeApi = {
  requestPhoneChange: (childId, guardianId, { newPhone, reason }) =>
    axiosClient.post(`/children/${childId}/guardians/${guardianId}/phone-change-requests`, { newPhone, reason }),
  listPhoneChangeRequests: (status) => axiosClient.get(requests, { params: { status } }),
  approvePhoneChange: (id) => axiosClient.post(`${requests}/${id}/approve`),
  rejectPhoneChange: (id, note) => axiosClient.post(`${requests}/${id}/reject`, { note }),
};
