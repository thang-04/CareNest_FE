import { USE_MOCK } from '@/config/env';
import { inspectionMockRepository as mock } from '@/services/inventory-inspection/mock/inspectionMockRepository';
import { inspectionApi as api } from '@/services/inventory-inspection/api/inspectionApi';

/** Facade used by hooks/pages. VITE_USE_MOCK=false switches to Spring Boot. */
const repo = USE_MOCK ? mock : api;

export const getInspections = (filters, user) => repo.list(filters, user);
export const getInspectionById = (id, user) => repo.getById(id, user);
export const getLockedLocations = () => repo.getLockedLocations();
export const getScopeAssets = (assetScope) => repo.getScopeAssets(assetScope);
export const getAssetCatalog = () => repo.getAssetCatalog();
export const getActiveTransfersAt = (locationIds) => repo.getActiveTransfersAt(locationIds);
export const saveInspectionDraft = (id, payload, user) => repo.saveDraft(id, payload, user);
export const startInspection = (id, payload, user) => repo.start(id, payload, user);
export const approveInspectionSheet = (id, sheetId, note, user) => repo.approveSheet(id, sheetId, note, user);
export const requestInspectionRecount = (id, sheetId, body, user) => repo.requestRecount(id, sheetId, body, user);
export const completeInspection = (id, body, user) => repo.complete(id, body, user);
export const cancelInspection = (id, reason, user) => repo.cancel(id, reason, user);
export const saveInspectionSheet = (id, sheetId, items, user) => repo.saveSheet(id, sheetId, items, user);
export const submitInspectionSheet = (id, sheetId, body, user) => repo.submitSheet(id, sheetId, body, user);
