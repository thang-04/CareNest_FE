import { USE_MOCK } from '@/config/env';
import { educationPlanMockRepository } from '@/services/education-plan/mock/educationPlanMockRepository';
import { educationPlanApi } from '@/services/education-plan/api/educationPlanApi';
import { classPlanMockRepository } from '@/services/education-plan/mock/classPlanMockRepository';
import { eduConfigMockRepository } from '@/services/education-plan/mock/eduConfigMockRepository';
import { branchAiMock } from '@/services/education-plan/mock/branchAiMock';

/** Facade: UI only calls these functions. */
const repo = USE_MOCK ? educationPlanMockRepository : educationPlanApi;

export const getEducationPlans = () => repo.getAll();
export const saveGoal = (item) => repo.saveGoal(item);
export const deleteGoal = (id) => repo.deleteGoal(id);
export const saveTheme = (item) => repo.saveTheme(item);
export const deleteTheme = (id) => repo.deleteTheme(id);
export const saveLesson = (item) => repo.saveLesson(item);
export const deleteLesson = (id) => repo.deleteLesson(id);

// Tài liệu kế hoạch của lớp (chủ đề nhánh, kế hoạch chủ đề, giáo án tuần). user: người thao tác (mock cần để kiểm quyền).
export const getClassPlans = () => (USE_MOCK ? classPlanMockRepository.getAll() : educationPlanApi.getClassPlans());
export const saveClassDoc = (kind, doc, user) =>
  USE_MOCK ? classPlanMockRepository.saveDoc(kind, doc, user) : educationPlanApi.saveClassDoc(kind, doc);
export const actOnClassDoc = (kind, id, body, user) =>
  USE_MOCK ? classPlanMockRepository.act(kind, id, body, user) : educationPlanApi.actOnClassDoc(kind, id, body);

// Cấu hình kế hoạch giáo dục của trường (lĩnh vực, người ký, dòng hoạt động tuần)
export const getEduConfig = () => (USE_MOCK ? eduConfigMockRepository.get() : educationPlanApi.getEduConfig());
export const saveEduConfig = (cfg, user) => (USE_MOCK ? eduConfigMockRepository.save(cfg, user) : educationPlanApi.saveEduConfig(cfg));

// AI gợi ý tên chủ đề nhánh (bản nháp; giáo viên chọn Dùng / Bỏ rồi vẫn ký, gửi duyệt như thường)
export const suggestBranchNames = (input) =>
  USE_MOCK ? branchAiMock.suggestBranchNames(input) : educationPlanApi.suggestBranchNames(input);
export const rewriteBranchName = (input) => (USE_MOCK ? branchAiMock.rewriteBranchName(input) : educationPlanApi.rewriteBranchName(input));
