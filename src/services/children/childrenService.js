import { USE_MOCK } from '@/config/env';
import { childrenMockRepository as mock } from '@/services/children/mock/childrenMockRepository';
import { childrenApi as api } from '@/services/children/api/childrenApi';

/** Facade for child records & child health. VITE_USE_MOCK=false switches to Spring Boot. */
const repo = USE_MOCK ? mock : api;

export const getChildren = (filters, user) => repo.listChildren(filters, user);
export const getChildDetail = (id, user) => repo.getChildDetail(id, user);
export const checkDuplicateChild = (data, user, excludeId) => repo.checkDuplicate(data, user, excludeId);
export const checkGuardianConflicts = (guardians, user) => repo.checkGuardianConflicts(guardians, user);
export const readmitChild = (childId, body, user) => repo.readmitChild(childId, body, user);
export const getPlacementClasses = (filters, user) => repo.getPlacementClasses(filters, user);
export const enrollChild = (payload, user) => repo.enrollChild(payload, user);
export const updateChild = (id, body, user) => repo.updateChild(id, body, user);
export const previewEnrollmentImport = (file, user) => repo.previewImport(file, user);
export const importChildren = (rows, user, campusId) => repo.importChildren(rows, user, campusId);
export const placeChild = (childId, body, user) => repo.placeChild(childId, body, user);
export const withdrawChild = (childId, body, user) => repo.withdrawChild(childId, body, user);
export const saveHealthDeclaration = (childId, body, user) => repo.saveDeclaration(childId, body, user);
export const getParentAccounts = (filters, user) => repo.listParentAccounts(filters, user);
export const findParentAccountByCitizenId = (idNumber, user) => repo.findParentAccountByCitizenId(idNumber, user);
export const getHealthRecord = (childId, user) => repo.getHealthRecord(childId, user);
export const saveMeasurement = (childId, measurementId, payload, user) => repo.saveMeasurement(childId, measurementId, payload, user);
export const analyzeHealthTrend = (childId, user) => repo.analyzeHealthTrend(childId, user);
