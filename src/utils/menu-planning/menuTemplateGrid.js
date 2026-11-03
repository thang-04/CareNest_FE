/*
 * Lưới bộ thực đơn mẫu (tuần 1–4 × thứ 2–6) ↔ bản nháp dạng kế hoạch tuần để dùng chung MealPlanGrid. Ngày của bản nháp là
 * ngày giả của một tuần neo (thứ Hai 01/01/2001) chỉ để định danh cột; lưới ẩn ngày khi hiển thị bộ mẫu.
 */
const ANCHOR = Date.UTC(2001, 0, 1);
const DAY_MS = 86_400_000;
export const TEMPLATE_WEEKS = [1, 2, 3, 4];
const WEEKDAYS = [1, 2, 3, 4, 5];

const anchorDate = (weekday) => new Date(ANCHOR + (weekday - 1) * DAY_MS).toISOString().slice(0, 10);

/** Món của tuần `weekNo` trong bộ -> bản nháp 5 ngày của khối bộ mẫu. */
export const weekDraft = (items, weekNo, block) => ({
  days: WEEKDAYS.map((weekday) => ({
    date: anchorDate(weekday),
    off: false,
    note: '',
    items: items
      .filter((item) => item.weekNo === weekNo && item.weekday === weekday)
      .map((item) => ({
        session: item.session,
        block,
        dishId: String(item.dishId),
        dishName: item.dishName || '',
        dishType: item.dishType || '',
      })),
  })),
});

/** Ghi bản nháp của một tuần trở lại danh sách món của bộ (thay các món cũ của tuần đó). */
export const applyWeekDraft = (items, weekNo, draft) => [
  ...items.filter((item) => item.weekNo !== weekNo),
  ...draft.days.flatMap((day, i) =>
    day.items.map((item) => ({
      weekNo,
      weekday: i + 1,
      session: item.session,
      dishId: item.dishId,
      dishName: item.dishName,
      dishType: item.dishType,
    })),
  ),
];

/** Form bộ mẫu -> body POST/PUT. */
export const toTemplateRequest = (form) => ({
  name: String(form.name || '').trim(),
  seasonLabel: String(form.seasonLabel || '').trim(),
  block: form.block,
  items: form.items.map(({ weekNo, weekday, session, dishId }) => ({ weekNo, weekday, session, dishId })),
});

/** Số món đã xếp của từng tuần trong bộ (hiện trên tab tuần). */
export const weekItemCounts = (items) =>
  Object.fromEntries(TEMPLATE_WEEKS.map((w) => [w, items.filter((item) => item.weekNo === w).length]));

/**
 * NUT-13: sao một tuần của bộ mẫu vào bản nháp kế hoạch tuần — thay món của khối bộ mẫu ở từng thứ, giữ khối còn lại,
 * ngày nghỉ giữ nguyên. Người lập xem lại rồi Lưu nháp; BE kiểm món còn dùng, bữa của khối khi lưu.
 */
export const copyTemplateWeek = (planDraft, template, weekNo) => ({
  ...planDraft,
  days: planDraft.days.map((day, i) => {
    if (day.off) return day;
    const fromTemplate = template.items
      .filter((item) => item.weekNo === weekNo && item.weekday === i + 1)
      .map((item) => ({
        session: item.session,
        block: template.block,
        dishId: String(item.dishId),
        dishName: item.dishName || '',
        dishType: item.dishType || '',
      }));
    return { ...day, items: [...day.items.filter((item) => item.block !== template.block), ...fromTemplate] };
  }),
});
