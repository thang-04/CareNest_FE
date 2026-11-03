import { USE_MOCK } from '@/config/env';
import { educationPlanMockRepository } from '@/services/education-plan/mock/educationPlanMockRepository';
import { educationPlanApi } from '@/services/education-plan/api/educationPlanApi';
import { classPlanMockRepository } from '@/services/education-plan/mock/classPlanMockRepository';
import { eduConfigMockRepository } from '@/services/education-plan/mock/eduConfigMockRepository';
import { branchAiMock } from '@/services/education-plan/mock/branchAiMock';
import { lessonAiMock } from '@/services/education-plan/mock/lessonAiMock';
import { curriculumMockRepository } from '@/services/education-plan/mock/curriculumMockRepository';

/** Facade: UI only calls these functions. */
const repo = USE_MOCK ? educationPlanMockRepository : educationPlanApi;

export const getEducationPlans = () => repo.getAll();
export const listGoalSources = (filters, actor, options) => repo.listGoalSources(filters, actor, options);
export const getGoalSource = (id, actor, options) => repo.getGoalSource(id, actor, options);
export const saveGoal = (item, options) => repo.saveGoal(item, options);
export const deleteGoal = (id, revision) => repo.deleteGoal(id, revision);
// Khóa "Đang sửa" kế hoạch năm (BE:EDU-10). user: người thao tác (mock cần); keepalive: gửi được cả khi đóng tab
export const startEditingGoal = (id, user, edit) => (USE_MOCK ? repo.startEditingGoal(id, user, edit) : repo.startEditingGoal(id, edit));
export const heartbeatGoal = (id, edit, user) => (USE_MOCK ? repo.heartbeatGoal(id, user, edit) : repo.heartbeatGoal(id, edit));
export const finishEditingGoal = (id, user, opts) => (USE_MOCK ? repo.finishEditingGoal(id, user, opts) : repo.finishEditingGoal(id, opts));
// Phiên bản kế hoạch năm (BE:EDU-25): tạo bản n+1 từ bản ban hành mới nhất; so sánh với phiên bản trước theo lineage
export const createGoalVersion = (id, user, edit) => (USE_MOCK ? repo.createGoalVersion(id, user, edit) : repo.createGoalVersion(id, edit));
export const getGoalChanges = (id, fromId) => repo.getGoalChanges(id, fromId);
// Nhập file bảng mục tiêu (BE:EDU-46): bản xem trước, không lưu
export const previewGoalFile = (file) => repo.previewGoalFile(file);
export const previewBranchFile = (file, context, user) =>
  USE_MOCK ? classPlanMockRepository.previewBranchFile(file, context, user) : educationPlanApi.previewBranchFile(file, context);
// Danh mục Chương trình GDMN của Bộ (BE:EDU-28): nguồn, mục tiêu và gợi ý nội dung theo nhóm tuổi (mã "ag-3")
const curriculum = USE_MOCK ? curriculumMockRepository : educationPlanApi;
export const getCurriculumSources = (options) => curriculum.getCurriculumSources(options);
export const getCurriculumGoals = (ageGroupCode, options) => curriculum.getCurriculumGoals(ageGroupCode, options);
export const getCurriculumContents = (ageGroupCode, options) => curriculum.getCurriculumContents(ageGroupCode, options);
export const saveTheme = (item) => repo.saveTheme(item);
export const deleteTheme = (id) => repo.deleteTheme(id);
export const saveLesson = (item) => repo.saveLesson(item);
export const deleteLesson = (id) => repo.deleteLesson(id);

// Tài liệu kế hoạch của lớp (chủ đề nhánh, kế hoạch chủ đề, giáo án tuần). user: người thao tác (mock cần để kiểm quyền).
// Kèm lớp (classes) và giáo viên, tổ trưởng (staff) người xem được; schoolYearId: năm đang chọn ở header
export const getClassPlans = (schoolYearId) => (USE_MOCK ? classPlanMockRepository.getAll() : educationPlanApi.getClassPlans(schoolYearId));
export const saveClassDoc = (kind, doc, user) =>
  USE_MOCK ? classPlanMockRepository.saveDoc(kind, doc, user) : educationPlanApi.saveClassDoc(kind, doc);
export const saveClassDocAdjustments = (id, adjustments, user) =>
  USE_MOCK ? classPlanMockRepository.saveAdjustments(id, adjustments, user) : educationPlanApi.saveClassDocAdjustments(id, adjustments);
export const actOnClassDoc = (kind, id, body, user) =>
  USE_MOCK ? classPlanMockRepository.act(kind, id, body, user) : educationPlanApi.actOnClassDoc(kind, id, body);

// Cấu hình kế hoạch giáo dục của trường (lĩnh vực, người ký, dòng hoạt động tuần)
export const getEduConfig = () => (USE_MOCK ? eduConfigMockRepository.get() : educationPlanApi.getEduConfig());
export const saveEduConfig = (cfg, user) => (USE_MOCK ? eduConfigMockRepository.save(cfg, user) : educationPlanApi.saveEduConfig(cfg));

// AI gợi ý tên chủ đề nhánh (bản nháp; giáo viên chọn Dùng / Bỏ rồi vẫn ký, gửi duyệt như thường)
export const suggestBranchNames = (input) =>
  USE_MOCK ? branchAiMock.suggestBranchNames(input) : educationPlanApi.suggestBranchNames(input);
// AI gợi ý tiến trình giờ học (nháp; giáo viên Giữ / Bỏ, sửa lại trước khi gửi duyệt). PROPOSED API
export const suggestLessonSteps = (input) =>
  USE_MOCK ? lessonAiMock.suggestLessonSteps(input) : educationPlanApi.suggestLessonSteps(input);
export const rewriteBranchName = (input) => (USE_MOCK ? branchAiMock.rewriteBranchName(input) : educationPlanApi.rewriteBranchName(input));
