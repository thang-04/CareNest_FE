import { beClient } from '@/services/http/beClient';
import { toPlanRequest } from '@/utils/menu-planning/mealPlanGrid';

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

  /** Công bố cả tuần; còn lỗi chặn thì BE trả 409 (màn nạp lại kế hoạch để hiện `issues`). */
  async publishPlan(weekStart) {
    return toPlan(await client.post(`/nutrition/meal-plans/${weekStart}/publish`));
  },
});

export const mealPlanApi = createMealPlanApi();
