import { sourceOf } from '@/services/demoSource';
import { healthCheckMockRepository as mock } from '@/services/children/mock/healthCheckMockRepository';
import { healthExamMockRepository as examMock } from '@/services/children/mock/healthExamMockRepository';
import { growthReportMockRepository as growthMock } from '@/services/children/mock/growthReportMockRepository';
import { healthCheckApi as api } from '@/services/children/api/healthCheckApi';

/**
 * Facade đợt khám sức khỏe, kỳ cân đo, phiếu khám Phụ lục II và tổng hợp cân đo mẫu 5.1. Nguồn mock/BE theo INTEGRATION_MODULES
 * (src/config/integrationModules.js).
 */
const repo = sourceOf('children', mock, api);
const examRepo = sourceOf('children', examMock, api);
const growthRepo = sourceOf('children', growthMock, api);

export const getHealthChecks = (filters, user) => repo.listHealthChecks(filters, user);
/** Tổng hợp cân đo mẫu 5.1: params { month: 'yyyy-MM', campusId? }. */
export const getGrowthReport = (params, user) => growthRepo.getGrowthReport(params, user);
export const getScheduleWarnings = (params, user) => repo.scheduleWarnings(params, user);
export const getHealthCheck = (id, user) => repo.getHealthCheck(id, user);
export const getHealthCheckClass = (id, classId, user) => repo.getHealthCheckClass(id, classId, user);
export const createHealthCheck = (payload, user) => repo.createHealthCheck(payload, user);
export const updateHealthCheck = (id, payload, user) => repo.updateHealthCheck(id, payload, user);
export const cancelHealthCheck = (id, user) => repo.cancelHealthCheck(id, user);
export const closeHealthCheck = (id, user) => repo.closeHealthCheck(id, user);
export const reopenHealthCheck = (id, body, user) => repo.reopenHealthCheck(id, body, user);
export const getHealthExam = (campaignId, childId, user) => examRepo.getHealthExam(campaignId, childId, user);
export const saveHealthExam = (campaignId, childId, payload, user) => examRepo.saveHealthExam(campaignId, childId, payload, user);
export const previewHealthExamReview = (campaignId, childId, payload, user) =>
  examRepo.previewHealthExamReview(campaignId, childId, payload, user);
