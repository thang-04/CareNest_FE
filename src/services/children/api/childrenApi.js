import { axiosClient } from '@/services/http/axiosClient';

/**
 * PROPOSED Spring Boot contract for child records & child health (not agreed with CareNest_BE yet).
 * Same names and shapes as the mock repository; the backend reads the user's scope from the JWT.
 */
export const childrenApi = {
  listChildren: (filters) => axiosClient.get('/children', { params: filters }),
  getChildDetail: (id) => axiosClient.get(`/children/${id}/profile`),
  checkDuplicate: (data, _user, excludeId) =>
    axiosClient.get('/children/duplicate-check', { params: { fullName: data.fullName, dateOfBirth: data.dateOfBirth, excludeId } }),
  getPlacementClasses: (filters) => axiosClient.get('/children/placement-classes', { params: filters }),
  enrollChild: (payload) => axiosClient.post('/children/enrollments', payload),
  updateChild: (id, body) => axiosClient.put(`/children/${id}`, body),
  previewImport: (file) => {
    const form = new FormData();
    form.append('file', file);
    return axiosClient.post('/children/enrollments/import/preview', form);
  },
  importChildren: (rows) => axiosClient.post('/children/enrollments/import', { rows }),
  placeChild: (childId, body) => axiosClient.post(`/children/${childId}/placement`, body),
  saveDeclaration: (childId, body) => axiosClient.put(`/children/${childId}/health-declaration`, body),
  confirmAllergies: (childId) => axiosClient.post(`/children/${childId}/health-declaration/confirm-allergies`),
  listParentAccounts: (filters) => axiosClient.get('/children/parent-accounts', { params: filters }),
  activateParentAccount: (childId, guardianIndex) => axiosClient.post(`/children/${childId}/guardians/${guardianIndex}/activate`),
  resendParentSms: (childId, guardianIndex) => axiosClient.post(`/children/${childId}/guardians/${guardianIndex}/resend-sms`),
  getHealthRecord: (childId) => axiosClient.get(`/children/${childId}/health`),
  saveMeasurement: (childId, measurementId, payload) =>
    measurementId
      ? axiosClient.put(`/children/${childId}/health/measurements/${measurementId}`, payload)
      : axiosClient.post(`/children/${childId}/health/measurements`, payload),
  publishMeasurement: (childId, measurementId) => axiosClient.post(`/children/${childId}/health/measurements/${measurementId}/publish`),
  analyzeHealthTrend: (childId) => axiosClient.post(`/children/${childId}/health/trend-analysis`),
};
