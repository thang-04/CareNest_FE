import { USE_MOCK } from '@/config/env';
import { healthCheckMockRepository as mock } from '@/services/children/mock/healthCheckMockRepository';
import { healthExamMockRepository as examMock } from '@/services/children/mock/healthExamMockRepository';
import { healthCheckApi as api } from '@/services/children/api/healthCheckApi';

/** Facade đợt khám sức khỏe, phiếu khám Phụ lục II và phiếu theo dõi. VITE_USE_MOCK=false chuyển sang Spring Boot. */
const repo = USE_MOCK ? mock : api;
const examRepo = USE_MOCK ? examMock : api;

export const getHealthChecks = (filters, user) => repo.listHealthChecks(filters, user);
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
export const getHealthFollowUps = (filters, user) => repo.listHealthFollowUps(filters, user);
export const getHealthFollowUp = (id, user) => repo.getHealthFollowUp(id, user);
export const recordFollowUpContact = (id, body, user) => repo.recordFollowUpContact(id, body, user);
export const recordFollowUpExternalResult = (id, body, user) => repo.recordFollowUpExternalResult(id, body, user);
export const closeFollowUp = (id, body, user) => repo.closeFollowUp(id, body, user);
