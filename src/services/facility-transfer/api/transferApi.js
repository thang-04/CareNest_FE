import { axiosClient } from '@/services/http/axiosClient';

/**
 * Spring Boot endpoints (PROPOSED contract – not agreed with CareNest_BE yet). Same signatures as the mock
 * repository so the facade can switch with VITE_USE_MOCK=false. The backend reads the user from the JWT.
 *
 * Rules the backend must enforce (reference implementation: mock/transferMockRepository.js):
 * - Only a VICE_PRINCIPAL creates / edits / cancels / resolves, and only for transfers whose sending campus is theirs
 *   (GBR-FAC-06); the receiving campus VP may view. Others see only transfers where they are handover or receiver.
 * - Storerooms (STORAGE) are never a transfer side (allocation BF-08). Handover / receiver = managerUserId of the
 *   sending / receiving room. Quantity <= stock minus quantities reserved by active transfers. No room under inventory.
 * - createdDate, signedAt and ids are set by the server; a signature must belong to the signer.
 * - handover / receipt / discrepancy bodies must contain every item line exactly once.
 * - Discrepancy report (signed by the receiver): per line receivedQuantity + damagedQuantity. Only the sending-campus VP
 *   resolves it, choosing per problem part: shortage SUPPLEMENT|ACCEPT, surplus RETURN|ACCEPT, damaged REPLACE|ACCEPT.
 *   All ACCEPT -> COMPLETED immediately with the received good quantities; otherwise PENDING_HANDOVER for the follow-up
 *   (POST /supplement with delivered / returned quantities), then the receiver confirms.
 * - Stock moves only at completion; stockMovements keep documentQuantity, handoverQuantity, quantity (moved),
 *   shortfall, surplus and damagedReturned so the ledger reconciles with the document.
 * Errors: 400/422 { message, details? }, 403 not allowed, 404 not found, 409 wrong status / inventory lock.
 */
export const transferApi = {
  list: (filters) => axiosClient.get('/facility-transfers', { params: filters }),
  getById: (id) => axiosClient.get(`/facility-transfers/${id}`),
  getStockSnapshot: (id) => axiosClient.get(`/facility-transfers/${id}/stock`),
  getAvailableAssets: (locationId, excludeTransferId) =>
    axiosClient.get(`/locations/${locationId}/assets/available`, { params: { excludeTransferId } }),
  saveDraft: (id, payload) =>
    id ? axiosClient.put(`/facility-transfers/${id}`, payload) : axiosClient.post('/facility-transfers', payload),
  submit: (id, payload) =>
    id ? axiosClient.post(`/facility-transfers/${id}/submit`, payload) : axiosClient.post('/facility-transfers/submit', payload),
  resubmit: (id, payload) => axiosClient.post(`/facility-transfers/${id}/resubmit`, payload),
  cancel: (id, reason) => axiosClient.post(`/facility-transfers/${id}/cancel`, { reason }),
  requestRevision: (id, reason) => axiosClient.post(`/facility-transfers/${id}/revision-requests`, { reason }),
  confirmHandover: (id, body) => axiosClient.post(`/facility-transfers/${id}/handover`, body),
  confirmReceipt: (id, body) => axiosClient.post(`/facility-transfers/${id}/receipt`, body),
  reportDiscrepancy: (id, body) => axiosClient.post(`/facility-transfers/${id}/discrepancies`, body),
  resolveDiscrepancy: (id, body) => axiosClient.post(`/facility-transfers/${id}/discrepancies/resolve`, body),
  confirmSupplement: (id, body) => axiosClient.post(`/facility-transfers/${id}/supplement`, body),
};
