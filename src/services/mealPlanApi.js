import { beClient } from '@/services/http/beClient';
import { toAmendRequest, toPlanRequest } from '@/utils/menu-planning/mealPlanGrid';
import { addDays } from '@/models/menu-planning/menuPlanningConstants';

/*
 * Kế hoạch tuần theo khối trên BE `/nutrition/meal-plans`: một lưới cho cả tuần (thứ Hai–thứ Sáu), lưu nháp ghi đè cả lưới,
 * công bố cả tuần một lần. Trạng thái, cờ canEdit/canPublish/publishable, đánh giá dinh dưỡng và lỗi chặn đều do BE trả.
 */
const blank = (v) => v === '' || v == null;
const params = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !blank(v)));

// BE luôn trả đủ các mảng; chuẩn hóa để màn không phải kiểm null từng chỗ
const toPlan = (plan) => ({
  ...plan,
  blocks: plan?.blocks || [],
  days: plan?.days || [],
  evaluations: plan?.evaluations || [],
  issues: plan?.issues || [],
});

/** Factory để test thay client HTTP. */
export const createMealPlanApi = ({ client = beClient } = {}) => ({
  /** Các tuần đã có kế hoạch trong khoảng ngày: [{ id, weekStart, status, publishedAt }]. */
  async listPlans({ from, to } = {}) {
    return (await client.get('/nutrition/meal-plans', { params: params({ from, to }) })) || [];
  },

  /** `weekStart` là thứ Hai (yyyy-mm-dd); tuần chưa lập vẫn trả đủ 5 ngày với status NONE. */
  async getPlan(weekStart) {
    return toPlan(await client.get(`/nutrition/meal-plans/${weekStart}`));
  },

  /** Lưu nháp: `draft` dạng bản nháp của mealPlanGrid; BE ghi đè cả lưới và trả kế hoạch kèm đánh giá mới. */
  async savePlan(weekStart, draft) {
    return toPlan(await client.put(`/nutrition/meal-plans/${weekStart}`, toPlanRequest(draft)));
  },

  /**
   * Thống kê một ngày thực đơn cho N trẻ của một nhóm tuổi (không lưu): bảng thực phẩm (lượng ăn, thải bỏ, lượng mua, tiền),
   * bảng kiểm dinh dưỡng, % năng lượng từng bữa. `children` trống ⇒ BE lấy suất đã xác nhận, không có thì sĩ số đang học.
   */
  async getMenuStatistics({ ageGroupId, date, campusId, children, items }) {
    const body = {
      ageGroupId,
      ...(date ? { date } : {}),
      ...(campusId ? { campusId } : {}),
      ...(children === '' || children == null ? {} : { children: Number(children) }),
      items: items.map(({ session, block, dishId }) => ({ session, ...(block ? { block } : {}), dishId })),
    };
    const stats = await client.post('/nutrition/menu-statistics', body);
    return { ...stats, dishes: stats?.dishes || [], ingredients: stats?.ingredients || [] };
  },

  /** Nhóm tuổi của trường (id BE, tên) để chọn nhóm khi xem thống kê. */
  async listAgeGroups() {
    return (await client.get('/age-groups')) || [];
  },

  /**
   * Đợt nghỉ (SCH-05, HT cấu hình theo năm học) chạm tuần `weekStart` (thứ Hai–thứ Sáu): [{ startDate, endDate, name }].
   * Đọc từ GET /school-years rồi GET /school-years/{id}/holidays của năm học chứa tuần đó.
   */
  async listWeekHolidays(weekStart) {
    const weekEnd = addDays(weekStart, 4);
    const years = ((await client.get('/school-years')) || []).filter((y) => y.startDate <= weekEnd && y.endDate >= weekStart);
    const lists = await Promise.all(years.map((y) => client.get(`/school-years/${y.id}/holidays`)));
    return lists.flat().filter((h) => h && h.startDate <= weekEnd && h.endDate >= weekStart);
  },

  /** Công bố cả tuần; còn lỗi chặn thì BE trả 409 (màn nạp lại kế hoạch để hiện `issues`). */
  async publishPlan(weekStart) {
    return toPlan(await client.post(`/nutrition/meal-plans/${weekStart}/publish`));
  },

  /**
   * Sửa ngoại lệ cả một ngày của tuần đã công bố (BE NUT-08, P-39): `day` là ngày của bản nháp sau khi sửa (mọi khối).
   * BE kiểm quyền, giờ chốt, lý do; trả kế hoạch mới (đánh giá, lưu ý tính lại).
   */
  async amendDay(weekStart, day, reason) {
    return toPlan(await client.put(`/nutrition/meal-plans/${weekStart}/days/${day.date}/amend`, toAmendRequest(day, reason)));
  },

  /** Lịch sử sửa ngoại lệ của tuần, mới nhất trước: [{ menuDate, before, after, reason, issues, changedByName, changedAt }]. */
  async listRevisions(weekStart) {
    return (await client.get(`/nutrition/meal-plans/${weekStart}/revisions`)) || [];
  },
});

export const mealPlanApi = createMealPlanApi();
