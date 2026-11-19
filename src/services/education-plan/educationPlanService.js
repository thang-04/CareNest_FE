import { calendarPayload, reorderCalendar } from '@/models/education-plan/branchCalendar.mjs';
import { USE_MOCK } from '@/config/env';
import { educationPlanMockRepository } from '@/services/education-plan/mock/educationPlanMockRepository';
import { educationPlanApi } from '@/services/education-plan/api/educationPlanApi';
import { classPlanMockRepository } from '@/services/education-plan/mock/classPlanMockRepository';
import { eduConfigMockRepository } from '@/services/education-plan/mock/eduConfigMockRepository';
import { branchAiMock } from '@/services/education-plan/mock/branchAiMock';
import { activityAiMock } from '@/services/education-plan/mock/activityAiMock';
import { lessonAiMock } from '@/services/education-plan/mock/lessonAiMock';
import { curriculumMockRepository } from '@/services/education-plan/mock/curriculumMockRepository';

/** Facade: UI only calls these functions. */
const repo = USE_MOCK ? educationPlanMockRepository : educationPlanApi;

export const getEducationPlans = (user) => repo.getAll(user);
// Trang chủ chỉ cần chủ đề, giờ học: API thật chưa có hai phần này (getAll trả rỗng) nên không tải chi tiết từng kế hoạch
// năm/tổ — tránh ~30 request tranh kết nối với trang kế hoạch giáo dục (FE-BUG-261111-dashboard-reload-burst)
export const getEducationLessons = (user) =>
  USE_MOCK ? repo.getAll(user).then(({ themes, lessons }) => ({ themes, lessons })) : Promise.resolve({ themes: [], lessons: [] });
export const getReviewQueue = (user) => repo.getReviewQueue(user);
export const getGoal = (id, user) => repo.getGoal(id, user);
export const getClassDocRelease = (releaseId) => repo.getClassDocRelease(releaseId);
export const listGoalSources = (filters, actor, options) => repo.listGoalSources(filters, actor, options);
export const getGoalSource = (id, actor, options) => repo.getGoalSource(id, actor, options);
export const saveGoal = (item, options) => repo.saveGoal(item, options);
export const resolveGoalReview = (id, reviewItemId, expectedSourcePlanId, edit, actor) =>
  repo.resolveGoalReview(id, reviewItemId, expectedSourcePlanId, edit, actor);
export const deleteGoal = (id, revision, actor) => repo.deleteGoal(id, revision, actor);
// Phiên bản kế hoạch năm (BE:EDU-25): tạo bản n+1 từ bản ban hành mới nhất; so sánh với phiên bản trước theo lineage
export const createGoalVersion = (id, user, edit) => (USE_MOCK ? repo.createGoalVersion(id, user, edit) : repo.createGoalVersion(id, edit));
export const getGoalChanges = (id, fromId, user) => repo.getGoalChanges(id, fromId, user);
// Spec 004 Q5: Hiệu trưởng mở khóa kế hoạch năm/tổ đã khóa theo ngày bắt đầu năm học (mock không khóa nên không có)
export const unlockGoal = (id, body) => educationPlanApi.unlockGoal(id, body);
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
export const getClassPlans = (schoolYearId, user) =>
  USE_MOCK ? classPlanMockRepository.getAll(user) : educationPlanApi.getClassPlans(schoolYearId);
export const saveClassDoc = (kind, doc, user, options) =>
  USE_MOCK ? classPlanMockRepository.saveDoc(kind, doc, user, options) : educationPlanApi.saveClassDoc(kind, doc, options);
export const actOnClassDoc = (kind, id, body, user, options) =>
  USE_MOCK ? classPlanMockRepository.act(kind, id, body, user, options) : educationPlanApi.actOnClassDoc(kind, id, body, options);

// Cấu hình kế hoạch giáo dục của trường (lĩnh vực, người ký, dòng hoạt động tuần)
export const getEduConfig = (user) => (USE_MOCK ? eduConfigMockRepository.get(user) : educationPlanApi.getEduConfig());
export const saveEduConfig = (cfg, user) => (USE_MOCK ? eduConfigMockRepository.save(cfg, user) : educationPlanApi.saveEduConfig(cfg));

// AI gợi ý tên chủ đề nhánh (bản nháp; giáo viên chọn Dùng / Bỏ rồi vẫn ký, gửi duyệt như thường)
export const suggestBranchNames = (input) =>
  USE_MOCK ? branchAiMock.suggestBranchNames(input) : educationPlanApi.suggestBranchNames(input);
// AI gợi ý tiến trình giờ học (nháp; giáo viên Giữ / Bỏ, sửa lại trước khi gửi duyệt). PROPOSED API
export const suggestLessonSteps = (input) =>
  USE_MOCK ? lessonAiMock.suggestLessonSteps(input) : educationPlanApi.suggestLessonSteps(input);
export const rewriteBranchName = (input) => (USE_MOCK ? branchAiMock.rewriteBranchName(input) : educationPlanApi.rewriteBranchName(input));
// AI gợi ý thẻ hoạt động cho MT chưa có hoạt động (EDU-20 mở rộng, Tiền 13/11/2026). BE chưa có API ⇒ luôn dùng bản giả, chưa nối API thật
export const suggestActivityCards = (input) => activityAiMock.suggestActivityCards(input);

export const saveWorkflowPolicy = (cfg, user) =>
  USE_MOCK ? eduConfigMockRepository.saveWorkflowPolicy(cfg, user) : educationPlanApi.saveWorkflowPolicy(cfg);

export const previewClassCalendar = async (request, plan) =>
  USE_MOCK
    ? { calendar: reorderCalendar(request.draftCalendar, plan, request.orderedThemeIds) }
    : educationPlanApi.previewClassCalendar({ ...request, draftCalendar: calendarPayload(request.draftCalendar) });
