import { USE_MOCK } from '@/config/env';
import { transferMockRepository as mock } from '@/services/facility-transfer/mock/transferMockRepository';
import { transferApi as api } from '@/services/facility-transfer/api/transferApi';

/**
 * Facade used by hooks/pages. Components call these functions only;
 * switch to Spring Boot by setting VITE_USE_MOCK=false.
 * `user` is passed so the mock can enforce role rules (the API uses the JWT).
 */
const repo = USE_MOCK ? mock : api;

/* Transfers */
export const getTransfers = (filters, user) => repo.list(filters, user);
export const getTransferById = (id, user) => repo.getById(id, user);
export const getAvailableAssets = (locationId, excludeTransferId) => repo.getAvailableAssets(locationId, excludeTransferId);
export const getTransferStockSnapshot = (id, user) => repo.getStockSnapshot(id, user);
export const createTransfer = (payload, user) => repo.saveDraft(null, payload, user);
export const updateTransfer = (id, payload, user) => repo.saveDraft(id, payload, user);
export const submitTransfer = (id, payload, user) => repo.submit(id, payload, user);
export const resubmitTransfer = (id, payload, user) => repo.resubmit(id, payload, user);
export const cancelTransfer = (id, reason, user) => repo.cancel(id, reason, user);
export const requestTransferRevision = (id, reason, user) => repo.requestRevision(id, reason, user);
export const confirmHandover = (id, body, user) => repo.confirmHandover(id, body, user);
export const confirmReceipt = (id, body, user) => repo.confirmReceipt(id, body, user);
export const reportDiscrepancy = (id, body, user) => repo.reportDiscrepancy(id, body, user);
export const resolveDiscrepancy = (id, body, user) => repo.resolveDiscrepancy(id, body, user);
export const confirmSupplement = (id, body, user) => repo.confirmSupplement(id, body, user);
