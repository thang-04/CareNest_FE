import { sourceOf } from '@/services/demoSource';
import { childrenMockRepository as mock } from '@/services/children/mock/childrenMockRepository';
import { childrenApi as api } from '@/services/children/api/childrenApi';

/** Facade for child records & child health. Nguồn mock/BE theo INTEGRATION_MODULES (src/config/integrationModules.js). */
const repo = sourceOf('children', mock, api);

export const getChildren = (filters, user) => repo.listChildren(filters, user);
export const getChildDetail = (id, user) => repo.getChildDetail(id, user);
export const checkDuplicateChild = (data, user, excludeId) => repo.checkDuplicate(data, user, excludeId);
export const checkGuardianConflicts = (guardians, user) => repo.checkGuardianConflicts(guardians, user);
export const readmitChild = (childId, body, user) => repo.readmitChild(childId, body, user);
export const getPlacementClasses = (filters, user) => repo.getPlacementClasses(filters, user);
export const getClassOptions = (schoolYear, user, options) => repo.getClassOptions(schoolYear, user, options);
export const enrollChild = (payload, user) => repo.enrollChild(payload, user);
export const updateChild = (id, body, user) => repo.updateChild(id, body, user);
export const previewEnrollmentImport = (file, user) => repo.previewImport(file, user);
export const importChildren = (rows, user, campusId, intake) => repo.importChildren(rows, user, campusId, intake);
export const placeChild = (childId, body, user) => repo.placeChild(childId, body, user);
export const cancelScheduledPlacement = (childId, user) => repo.cancelScheduledPlacement(childId, user);
export const getSchoolHolidays = (schoolYearId, user) => repo.getSchoolHolidays(schoolYearId, user);
export const getLeaveOptions = (childId, user) => repo.getLeaveOptions(childId, user);
export const withdrawChild = (childId, body, user) => repo.withdrawChild(childId, body, user);
export const cancelScheduledLeave = (childId, user) => repo.cancelScheduledLeave(childId, user);
export const saveHealthDeclaration = (childId, body, user) => repo.saveDeclaration(childId, body, user);
// CHD-11: GV gửi yêu cầu sửa hồ sơ/khai báo; HT, PHT điểm trường duyệt
export const submitProfileChange = (childId, body, user) => repo.submitProfileChange(childId, body, user);
export const getLatestProfileChanges = (childId, user) => repo.getLatestProfileChanges(childId, user);
export const getProfileChanges = (status, user) => repo.listProfileChanges(status, user);
export const approveProfileChange = (requestId, user) => repo.approveProfileChange(requestId, user);
export const rejectProfileChange = (requestId, note, user) => repo.rejectProfileChange(requestId, note, user);
export const getParentAccounts = (filters, user) => repo.listParentAccounts(filters, user);
export const findParentAccountByCitizenId = (idNumber, user) => repo.findParentAccountByCitizenId(idNumber, user);
export const getHealthRecord = (childId, user) => repo.getHealthRecord(childId, user);
export const saveMeasurement = (childId, measurementId, payload, user) => repo.saveMeasurement(childId, measurementId, payload, user);
export const analyzeHealthTrend = (childId, period, user) => repo.analyzeHealthTrend(childId, period, user);
export const getLatestHealthTrend = (childId, user) => repo.getLatestHealthTrend(childId, user);
export const approveHealthTrend = (childId, interpretationId, content, user) =>
  repo.approveHealthTrend(childId, interpretationId, content, user);
