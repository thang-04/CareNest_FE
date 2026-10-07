import { USE_MOCK } from '@/config/env';
import { childrenMockRepository as mock } from '@/services/children/mock/childrenMockRepository';
import { childrenApi as api } from '@/services/children/api/childrenApi';

/** Facade for child records & child health. VITE_USE_MOCK=false switches to Spring Boot. */
const repo = USE_MOCK ? mock : api;

export const getChildren = (filters, user) => repo.listChildren(filters, user);
export const getChildDetail = (id, user) => repo.getChildDetail(id, user);
export const checkDuplicateChild = (data, user, excludeId) => repo.checkDuplicate(data, user, excludeId);
export const getPlacementClasses = (filters, user) => repo.getPlacementClasses(filters, user);
export const enrollChild = (payload, user) => repo.enrollChild(payload, user);
export const updateChild = (id, body, user) => repo.updateChild(id, body, user);
export const previewEnrollmentImport = (file, user) => repo.previewImport(file, user);
export const importChildren = (rows, user) => repo.importChildren(rows, user);
export const placeChild = (childId, body, user) => repo.placeChild(childId, body, user);
export const saveHealthDeclaration = (childId, body, user) => repo.saveDeclaration(childId, body, user);
export const confirmAllergies = (childId, user) => repo.confirmAllergies(childId, user);
export const getParentAccounts = (filters, user) => repo.listParentAccounts(filters, user);
export const activateParentAccount = (childId, guardianIndex, user) => repo.activateParentAccount(childId, guardianIndex, user);
export const resendParentSms = (childId, guardianIndex, user) => repo.resendParentSms(childId, guardianIndex, user);
export const getHealthRecord = (childId, user) => repo.getHealthRecord(childId, user);
export const saveMeasurement = (childId, measurementId, payload, user) => repo.saveMeasurement(childId, measurementId, payload, user);
export const publishMeasurement = (childId, measurementId, user) => repo.publishMeasurement(childId, measurementId, user);
export const analyzeHealthTrend = (childId, user) => repo.analyzeHealthTrend(childId, user);
