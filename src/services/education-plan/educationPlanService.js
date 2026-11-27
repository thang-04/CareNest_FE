import { calendarPayload } from '@/models/education-plan/branchCalendar.mjs';
import { educationPlanApi as repo } from '@/services/education-plan/api/educationPlanApi';

/** Facade: UI only calls these functions. */
export const getEducationPlans = (user, filter) => repo.getAll(user, filter);
// Trang chủ chỉ cần chủ đề, giờ học: API thật chưa có hai phần này (getAll trả rỗng) nên không tải chi tiết từng kế hoạch
// năm/tổ — tránh ~30 request tranh kết nối với trang kế hoạch giáo dục (FE-BUG-261111-dashboard-reload-burst)
export const getReviewQueue = (user, schoolYearId) => repo.getReviewQueue(user, schoolYearId);

// edu-list-paging (Tiền 25/11/2026): danh sách kế hoạch năm/tổ, số liệu thẻ, bảng quá hạn phân trang ở BE.
export const getGoalPage = (user, filter = {}) => repo.getGoalPage(user, filter);
export const getGoalStats = (user, filter = {}) => repo.getGoalStats(user, filter);
export const getOverdueBoard = (user, schoolYearId, filter = {}) => repo.getOverdueBoard(schoolYearId, filter);
export const getGoal = (id, user) => repo.getGoal(id, user);
export const getOverdueGoal = (user, schoolYearId, id) => repo.getOverdueGoal(id, schoolYearId);
export const getOverduePlans = async (user, schoolYearId) => {
  const [plans, docs] = await Promise.all([repo.getAll(user, { schoolYearId, overdue: true }), repo.getOverdueClassPlans(schoolYearId)]);
  return { ...plans, ...docs };
};
export const getClassDocRelease = (releaseId) => repo.getClassDocRelease(releaseId);
export const listGoalSources = (filters, actor, options) => repo.listGoalSources(filters, actor, options);
export const getGoalSource = (id, actor, options) => repo.getGoalSource(id, actor, options);
export const saveGoal = (item, options) => repo.saveGoal(item, options);
export const resolveGoalReview = (id, reviewItemId, expectedSourcePlanId, edit, actor) =>
  repo.resolveGoalReview(id, reviewItemId, expectedSourcePlanId, edit, actor);
export const deleteGoal = (id, revision, actor) => repo.deleteGoal(id, revision, actor);
// Phiên bản kế hoạch năm (BE:EDU-25): tạo bản n+1 từ bản ban hành mới nhất; so sánh với phiên bản trước theo lineage
export const createGoalVersion = (id, user, edit) => repo.createGoalVersion(id, edit);
export const getGoalChanges = (id, fromId, user) => repo.getGoalChanges(id, fromId, user);
// Spec 004 Q5: Hiệu trưởng mở khóa kế hoạch năm/tổ đã khóa theo ngày bắt đầu năm học
export const unlockGoal = (id, body) => repo.unlockGoal(id, body);
// Nhập file bảng mục tiêu (BE:EDU-46): bản xem trước, không lưu
export const previewGoalFile = (file) => repo.previewGoalFile(file);
export const previewBranchFile = (file, context) => repo.previewBranchFile(file, context);
// Danh mục Chương trình GDMN của Bộ (BE:EDU-28): nguồn, mục tiêu và gợi ý nội dung theo nhóm tuổi (mã "ag-3")
export const getCurriculumSources = (options) => repo.getCurriculumSources(options);
export const getCurriculumGoals = (ageGroupCode, options) => repo.getCurriculumGoals(ageGroupCode, options);
export const getCurriculumContents = (ageGroupCode, options) => repo.getCurriculumContents(ageGroupCode, options);

// Tài liệu kế hoạch của lớp (chủ đề nhánh, kế hoạch chủ đề, giáo án tuần). user: người thao tác.
// Kèm lớp (classes) và giáo viên, tổ trưởng (staff) người xem được; schoolYearId: năm đang chọn ở header
// classId: trang của một lớp chỉ tải tài liệu lớp đó
export const getClassPlans = (schoolYearId, user, review, classId, overdue) => repo.getClassPlans(schoolYearId, review, classId, overdue);
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
export const getClassDocSummaries = (schoolYearId, user, filter) => repo.getClassDocSummaries(schoolYearId, filter);
export const getClassDoc = (kind, docKey) => repo.getClassDoc(kind, docKey);
export const getClassDocContext = (schoolYearId) => repo.getClassDocContext(schoolYearId);
export const saveClassDoc = (kind, doc, user, options) => repo.saveClassDoc(kind, doc, options);
export const actOnClassDoc = (kind, id, body, user, options) => repo.actOnClassDoc(kind, id, body, options);

// Cấu hình kế hoạch giáo dục của trường (lĩnh vực, người ký, dòng hoạt động tuần)
export const getEduConfig = () => repo.getEduConfig();
export const getEduConfigCached = () => repo.getEduConfigCached();
export const saveEduConfig = (cfg) => repo.saveEduConfig(cfg);

// AI gợi ý tiến trình giờ học (nháp; giáo viên Giữ / Bỏ, sửa lại trước khi gửi duyệt)
export const suggestLessonSteps = (input) => repo.suggestLessonSteps(input);
// AI gợi ý thẻ hoạt động cho MT (BE:EDU-95): BE chỉ trả MT, loại giờ có trong yêu cầu
export const suggestActivityCards = (input) => repo.suggestActivityCards(input);
// BE:EDU-96 — khung Kiểm tra cho người duyệt; BE:EDU-95 — Sửa theo yêu cầu
export const getClassDocChecks = (kind, docKey) => repo.getClassDocChecks(kind, docKey);
export const editDayByRequest = (docKey, prompt) => repo.editDayByRequest(docKey, prompt);
// BE:EDU-103 — AI gom nội dung vào chủ đề ở kế hoạch tổ (nháp, áp dụng chỉ thêm tick) và log tỉ lệ giữ
export const matchThemeContents = (planId, body) => repo.matchThemeContents(planId, body);
export const rewriteClassContents = (body) => repo.rewriteClassContents(body);
export const matchGoalContents = (planId, options) => repo.matchGoalContents(planId, options);
export const sendAiFeedback = (body) => repo.sendAiFeedback(body);

export const previewClassCalendar = (request) =>
  repo.previewClassCalendar({ ...request, draftCalendar: calendarPayload(request.draftCalendar) });
