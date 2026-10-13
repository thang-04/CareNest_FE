import { USE_MOCK } from '@/config/env';
import { educationPlanMockRepository } from '@/services/education-plan/mock/educationPlanMockRepository';
import { classPlanMockRepository } from '@/services/education-plan/mock/classPlanMockRepository';
import { generatePlanDraft } from '@/services/education-plan/mock/planAiDraftMock';
import { educationPlanApi, classPlanApi } from '@/services/education-plan/api/educationPlanApi';

/** Facade: UI only calls these functions. */
const repo = USE_MOCK ? educationPlanMockRepository : educationPlanApi;
const planRepo = USE_MOCK ? { ...classPlanMockRepository, generateDraft: generatePlanDraft } : classPlanApi;

export const getEducationPlans = () => repo.getAll();
export const saveGoal = (item) => repo.saveGoal(item);
export const deleteGoal = (id) => repo.deleteGoal(id);
export const saveTheme = (item) => repo.saveTheme(item);
export const deleteTheme = (id) => repo.deleteTheme(id);
export const saveLesson = (item) => repo.saveLesson(item);
export const deleteLesson = (id) => repo.deleteLesson(id);

/* Kế hoạch năm theo khối + tài liệu của lớp. user chỉ dùng cho mock (API thật lấy từ token). */
export const getClassPlans = () => planRepo.getAll();
export const savePlanDoc = (kind, doc, user) => planRepo.saveDoc(kind, doc, user);
export const deleteYearPlan = (id, user) => planRepo.deleteYearPlan(id, user);
export const actOnPlanDoc = (kind, id, body, user) => planRepo.act(kind, id, body, user);
export const getPlanReviewQueue = (user) => planRepo.getReviewQueue(user);
/** Nháp AI: chỉ trả nội dung để người dùng chọn, không ghi gì vào tài liệu. */
export const generatePlanAiDraft = (type, context) => planRepo.generateDraft(type, context);
