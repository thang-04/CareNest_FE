import { beClient } from '@/services/http/beClient';

/*
 * Nháp AI gợi ý thực đơn trên BE `/nutrition/menu-ai-drafts` (AI-01, AI-07): BE lọc món, gọi model, kiểm và chấm điểm;
 * FE chỉ gửi yêu cầu, hiển thị nguồn, điểm, bảng kiểm, lưới món và chuyển quyết định dùng/bỏ của người duyệt.
 */
const blank = (v) => v === '' || v == null;
const body = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !blank(v)));

// BE luôn trả đủ mảng; chuẩn hóa để màn không phải kiểm null từng chỗ
const toDraft = (draft) => ({
  ...draft,
  days: (draft?.days || []).map((d) => ({ ...d, items: d.items || [] })),
  slots: draft?.slots || [],
  issues: draft?.issues || [],
  checks: draft?.checks || [],
  score: draft?.score || {},
});

/** Factory để test thay client HTTP. */
export const createMenuAiDraftApi = ({ client = beClient } = {}) => ({
  /**
   * Tạo nháp (đồng bộ, có thể tới ~30 giây). `kind`: MENU_WEEKLY (cần weekStart), MENU_DAILY, MENU_DAY_FIX (cần weekStart,
   * targetDate, targetSession, fromDishId). Trả cả khi không có phương án (status NO_FEASIBLE).
   */
  async createDraft({ kind, block, weekStart, season, wishes, targetDate, targetSession, fromDishId }) {
    return toDraft(
      await client.post(
        '/nutrition/menu-ai-drafts',
        body({ kind, block, weekStart, season, wishes, targetDate, targetSession, fromDishId }),
      ),
    );
  },

  async getDraft(id) {
    return toDraft(await client.get(`/nutrition/menu-ai-drafts/${id}`));
  },

  /** Bỏ nháp đang chờ duyệt. */
  async dismissDraft(id) {
    return toDraft(await client.post(`/nutrition/menu-ai-drafts/${id}/dismiss`));
  },

  /**
   * Dùng nháp tuần / thay một món: BE ghi vào kế hoạch tuần nháp (không công bố), trả kế hoạch tuần. `grid` (chỉ gợi ý
   * tuần) = lưới người duyệt đã sửa `{ days: [{ date, items: [{ slot, dishId }] }] }`; bỏ trống ⇒ dùng nguyên gợi ý.
   */
  async applyDraft(id, grid) {
    return grid ? client.post(`/nutrition/menu-ai-drafts/${id}/apply`, grid) : client.post(`/nutrition/menu-ai-drafts/${id}/apply`);
  },

  /** Món ứng viên theo ô của nháp tuần đang chờ duyệt: `{ slots: [{ key, session, index, dishTypes, dishes }] }`. */
  async getCandidates(id) {
    const data = await client.get(`/nutrition/menu-ai-drafts/${id}/candidates`);
    return { slots: (data?.slots || []).map((slot) => ({ ...slot, dishes: slot.dishes || [] })) };
  },

  /** Chấm thử lưới đã sửa (BE không lưu): `{ feasible, editedCells, score, evaluations, issues, checks }`. */
  async evaluateDraft(id, grid) {
    return client.post(`/nutrition/menu-ai-drafts/${id}/evaluate`, grid);
  },

  /** Mẫu ngày: đánh dấu đã dùng sau khi điền vào form mẫu (BE không ghi bảng mẫu). */
  async markDailyUsed(id) {
    return toDraft(await client.post(`/nutrition/menu-ai-drafts/${id}/mark-used`));
  },
});

export const menuAiDraftApi = createMenuAiDraftApi();
