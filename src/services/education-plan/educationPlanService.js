import { AGE_GROUPS, ageRangeKey } from '@/models/education-plan/educationPlanConstants';
import { calendarPayload, reorderCalendar } from '@/models/education-plan/branchCalendar.mjs';
import { USE_MOCK } from '@/config/env';
import { overdueRows, filterOverdue } from '@/models/education-plan/overdue.mjs';
import { educationPlanMockRepository } from '@/services/education-plan/mock/educationPlanMockRepository';
import { educationPlanApi } from '@/services/education-plan/api/educationPlanApi';
import { classPlanMockRepository } from '@/services/education-plan/mock/classPlanMockRepository';
import { eduConfigMockRepository } from '@/services/education-plan/mock/eduConfigMockRepository';
import { reviewAiMock } from '@/services/education-plan/mock/reviewAiMock';
import { themeContentAiMock } from '@/services/education-plan/mock/themeContentAiMock';
import { curriculumMockRepository } from '@/services/education-plan/mock/curriculumMockRepository';

/** Facade: UI only calls these functions. */
const repo = USE_MOCK ? educationPlanMockRepository : educationPlanApi;

export const getEducationPlans = async (user, filter) => {
  const result = await repo.getAll(user, filter);
  if (!USE_MOCK || !filter?.ageRange) return result;
  const matching = new Set(AGE_GROUPS.filter((group) => ageRangeKey(group) === filter.ageRange).map((group) => group.id));
  return {
    ...result,
    goals: result.goals.filter(
      (goal) => (filter.schoolYearId != null || goal.schoolYear === filter.schoolYear) && matching.has(goal.ageGroupId),
    ),
  };
};
// Trang chủ chỉ cần chủ đề, giờ học: API thật chưa có hai phần này (getAll trả rỗng) nên không tải chi tiết từng kế hoạch
// năm/tổ — tránh ~30 request tranh kết nối với trang kế hoạch giáo dục (FE-BUG-261111-dashboard-reload-burst)
export const getEducationLessons = (user) =>
  USE_MOCK ? repo.getAll(user).then(({ themes, lessons }) => ({ themes, lessons })) : Promise.resolve({ themes: [], lessons: [] });
export const getReviewQueue = (user, schoolYearId) => repo.getReviewQueue(user, schoolYearId);

// edu-list-paging (Tiền 25/11/2026): danh sách kế hoạch năm/tổ, số liệu thẻ, bảng quá hạn phân trang ở BE.
// Mock là BE giả: lọc/cắt trang trên dữ liệu giả cùng luật với BE (ẩn bản đã thay thế = bản ban hành có bản ban hành mới hơn)
const pageOf = (items, page, size) => ({
  items: items.slice(page * size, page * size + size),
  page,
  size,
  totalElements: items.length,
  totalPages: Math.ceil(items.length / size),
});
const replacedIn = (list) => (g) =>
  g.status === 'APPROVED' &&
  list.some((x) => x.status === 'APPROVED' && x.ageGroupId === g.ageGroupId && (x.versionNo ?? 1) > (g.versionNo ?? 1));
export const getGoalPage = async (user, filter = {}) => {
  if (!USE_MOCK) return educationPlanApi.getGoalPage(user, filter);
  const { planLevel, schoolYearId, ageRange, q, currentOnly = true, page = 0, size = 5 } = filter;
  const { goals } = await getEducationPlans(user, { planLevel, schoolYearId, ageRange });
  const level = goals.filter((g) => (g.planLevel || 'TEAM') === planLevel);
  const replaced = replacedIn(level);
  const shown = level
    .filter((g) => (!currentOnly || !replaced(g)) && (!q?.trim() || `${g.title}${g.code}`.toLowerCase().includes(q.trim().toLowerCase())))
    .map((g) => ({ ...g, current: g.status === 'APPROVED' ? !replaced(g) : g.current }));
  return pageOf(shown, page, size);
};
export const getGoalStats = async (user, filter = {}) => {
  if (!USE_MOCK) return educationPlanApi.getGoalStats(user, filter);
  const { goals } = await getEducationPlans(user, { planLevel: filter.planLevel, schoolYearId: filter.schoolYearId });
  const level = goals.filter((g) => (g.planLevel || 'TEAM') === filter.planLevel);
  return {
    total: level.length,
    issued: level.filter((g) => g.status === 'APPROVED' || g.status === 'SENT').length,
    replaced: level.filter(replacedIn(level)).length,
    ageGroupIdsWithPlan: [...new Set(level.map((g) => g.ageGroupId))],
  };
};
export const getOverdueBoard = async (user, schoolYearId, filter = {}) => {
  if (!USE_MOCK) return educationPlanApi.getOverdueBoard(schoolYearId, filter);
  const { page = 0, size = 5, ...rest } = filter;
  const data = await getOverduePlans(user, schoolYearId);
  const rows = overdueRows({ ...data, yearPlans: data.goals, themeNameOf: () => 'Chủ đề', today: new Date().toISOString().slice(0, 10) });
  const shown = filterOverdue(rows, { ...rest, semesterNo: rest.semesterNo ?? '' });
  return {
    rows: pageOf(shown, page, size),
    overdueCount: filterOverdue(rows, { tab: 'overdue' }).length,
    extendedCount: filterOverdue(rows, { tab: 'extended' }).length,
    semesters: [...new Set(rows.map((r) => r.semesterNo).filter((n) => n != null))].sort(),
  };
};
export const getGoal = (id, user) => repo.getGoal(id, user);
export const getOverduePlans = async (user, schoolYearId) => {
  if (USE_MOCK) {
    const [plans, docs] = await Promise.all([
      repo.getAll(user, { schoolYearId, overdue: true }),
      classPlanMockRepository.getOverdue(user, schoolYearId),
    ]);
    return { ...plans, ...docs };
  }
  const [plans, docs] = await Promise.all([
    educationPlanApi.getAll(user, { schoolYearId, overdue: true }),
    educationPlanApi.getOverdueClassPlans(schoolYearId),
  ]);
  return { ...plans, ...docs };
};
export const getOverduePlan = (user, schoolYearId, kind, id) => {
  const classDoc = kind === 'semester' || kind === 'dossier';
  if (USE_MOCK)
    return classDoc ? classPlanMockRepository.getOverdueDoc(user, schoolYearId, kind, id) : repo.getOverdueGoal(user, schoolYearId, id);
  return classDoc ? educationPlanApi.getOverdueClassDoc(kind, id, schoolYearId) : educationPlanApi.getOverdueGoal(id, schoolYearId);
};
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
// classId: trang của một lớp chỉ tải tài liệu lớp đó (mock trả cả phạm vi, trang tự lọc theo lớp)
export const getClassPlans = (schoolYearId, user, review, classId) =>
  USE_MOCK ? classPlanMockRepository.getAll(user, schoolYearId, review) : educationPlanApi.getClassPlans(schoolYearId, review, classId);
// Mọi bản gọn của các loại tài liệu (đi qua từng trang 100 dòng của BE); dùng khi màn cần cả danh sách, không phân trang
export const getAllClassDocSummaries = async (schoolYearId, user, kinds, filter = {}) => {
  const items = [];
  for (let page = 0, total = 1; page < total; page++) {
    const result = await getClassDocSummaries(schoolYearId, user, { ...filter, kinds, page, size: 100 });
    items.push(...(result.items || []));
    total = result.totalPages ?? 1;
  }
  return items;
};
// edu-list-paging: danh sách gọn (trang BE 5 dòng), chi tiết theo khóa, lớp/nhân sự không kèm tài liệu
export const getClassDocSummaries = (schoolYearId, user, filter) =>
  USE_MOCK ? classPlanMockRepository.getSummaries(user, schoolYearId, filter) : educationPlanApi.getClassDocSummaries(schoolYearId, filter);
export const getClassDoc = (kind, docKey, user, schoolYearId) =>
  USE_MOCK ? classPlanMockRepository.getOne(user, schoolYearId, kind, docKey) : educationPlanApi.getClassDoc(kind, docKey);
export const getClassDocContext = (schoolYearId, user) =>
  USE_MOCK ? classPlanMockRepository.getContext(user, schoolYearId) : educationPlanApi.getClassDocContext(schoolYearId);
export const saveClassDoc = (kind, doc, user, options) =>
  USE_MOCK ? classPlanMockRepository.saveDoc(kind, doc, user, options) : educationPlanApi.saveClassDoc(kind, doc, options);
export const actOnClassDoc = (kind, id, body, user, options) =>
  USE_MOCK ? classPlanMockRepository.act(kind, id, body, user, options) : educationPlanApi.actOnClassDoc(kind, id, body, options);

// Cấu hình kế hoạch giáo dục của trường (lĩnh vực, người ký, dòng hoạt động tuần)
export const getEduConfig = (user) => (USE_MOCK ? eduConfigMockRepository.get(user) : educationPlanApi.getEduConfig());
export const getEduConfigCached = (user) =>
  USE_MOCK ? eduConfigMockRepository.get(user) : educationPlanApi.getEduConfigCached();
export const saveEduConfig = (cfg, user) => (USE_MOCK ? eduConfigMockRepository.save(cfg, user) : educationPlanApi.saveEduConfig(cfg));

// Chế độ mock không có AI (bỏ dữ liệu AI giả, Tiền 25/11/2026): báo không khả dụng như khi AI tắt (AI-03)
const aiUnavailable = () => Promise.reject(Object.assign(new Error('Trợ lý AI đang không khả dụng, vui lòng thử lại sau'), { status: 503 }));
// AI gợi ý tiến trình giờ học (nháp; giáo viên Giữ / Bỏ, sửa lại trước khi gửi duyệt)
export const suggestLessonSteps = (input) => (USE_MOCK ? aiUnavailable() : educationPlanApi.suggestLessonSteps(input));
// AI gợi ý thẻ hoạt động cho MT (BE:EDU-95): BE chỉ trả MT, loại giờ có trong yêu cầu
export const suggestActivityCards = (input) => (USE_MOCK ? aiUnavailable() : educationPlanApi.suggestActivityCards(input));
// BE:EDU-96 — khung Kiểm tra / Tóm tắt cho người duyệt; BE:EDU-95 — Sửa theo yêu cầu
export const getClassDocChecks = (kind, docKey) =>
  USE_MOCK ? reviewAiMock.getClassDocChecks(kind, docKey) : educationPlanApi.getClassDocChecks(kind, docKey);
export const editDayByRequest = (docKey, prompt) =>
  USE_MOCK ? reviewAiMock.editDayByRequest(docKey, prompt) : educationPlanApi.editDayByRequest(docKey, prompt);
export const reviewDay = (docKey) => (USE_MOCK ? reviewAiMock.reviewDay(docKey) : educationPlanApi.reviewDay(docKey));
// BE:EDU-103 — AI gom nội dung vào chủ đề ở kế hoạch tổ (nháp, áp dụng chỉ thêm tick) và log tỉ lệ giữ
export const matchThemeContents = (planId, body) =>
  USE_MOCK ? themeContentAiMock.matchThemeContents(planId, body) : educationPlanApi.matchThemeContents(planId, body);
export const matchGoalContents = (planId, options) =>
  USE_MOCK ? themeContentAiMock.matchGoalContents(planId, options) : educationPlanApi.matchGoalContents(planId, options);
// BE:EDU-104 — lấy tick từ kế hoạch tổ năm trước (FE ghép chủ đề/nội dung, áp dụng chỉ thêm tick)
export const getPreviousYearTicks = (planId) =>
  USE_MOCK ? themeContentAiMock.getPreviousYearTicks(planId) : educationPlanApi.getPreviousYearTicks(planId);
export const sendAiFeedback = (body) => (USE_MOCK ? themeContentAiMock.sendAiFeedback(body) : educationPlanApi.sendAiFeedback(body));

export const previewClassCalendar = async (request, plan) =>
  USE_MOCK
    ? { calendar: reorderCalendar(request.draftCalendar, plan, request.orderedThemeIds) }
    : educationPlanApi.previewClassCalendar({ ...request, draftCalendar: calendarPayload(request.draftCalendar) });
