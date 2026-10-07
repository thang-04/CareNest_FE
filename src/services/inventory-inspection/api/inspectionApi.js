import { axiosClient } from '@/services/http/axiosClient';

/** Proposed Spring Boot contract for the inventory module (same shape as the mock). */
export const inspectionApi = {
  list: (filters) => axiosClient.get('/inspections', { params: filters }),
  getById: (id) => axiosClient.get(`/inspections/${id}`),
  getLockedLocations: () => axiosClient.get('/inspections/locked-locations'),
  getScopeAssets: (assetScope) => axiosClient.post('/inspections/scope-preview', assetScope),
  getAssetCatalog: () => axiosClient.get('/assets/catalog'),
  getActiveTransfersAt: (locationIds) => axiosClient.get('/facility-transfers/active', { params: { locationIds: locationIds.join(',') } }),
  saveDraft: (id, payload) => (id ? axiosClient.put(`/inspections/${id}`, payload) : axiosClient.post('/inspections', payload)),
  start: (id, payload) => (id ? axiosClient.post(`/inspections/${id}/start`, payload) : axiosClient.post('/inspections/start', payload)),
  approveSheet: (id, sheetId, note) => axiosClient.post(`/inspections/${id}/sheets/${sheetId}/approve`, { note }),
  requestRecount: (id, sheetId, body) => axiosClient.post(`/inspections/${id}/sheets/${sheetId}/recount`, body),
  complete: (id, body) => axiosClient.post(`/inspections/${id}/complete`, body),
  cancel: (id, reason) => axiosClient.post(`/inspections/${id}/cancel`, { reason }),
  saveSheet: (id, sheetId, items) => axiosClient.put(`/inspections/${id}/sheets/${sheetId}`, { items }),
  submitSheet: (id, sheetId, body) => axiosClient.post(`/inspections/${id}/sheets/${sheetId}/submit`, body),
};
