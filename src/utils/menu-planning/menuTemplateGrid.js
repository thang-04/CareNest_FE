/*
 * Thực đơn mẫu một ngày (BE NUT-13, user chốt 2026-11-04): mẫu = khối + nhãn mùa + các bữa → món.
 * Ở kế hoạch tuần, người lập chọn mẫu cho từng ngày; món của mẫu được điền vào bản nháp và vẫn sửa được từng món.
 */

/** Thứ trong tuần của ngày yyyy-mm-dd: 1 = Thứ Hai … 7 = Chủ nhật. */
const isoWeekday = (date) => new Date(`${date}T00:00:00`).getDay() || 7;

/**
 * Món của mẫu dùng cho một ngày kế hoạch. Mẫu một ngày: toàn bộ món. Bộ 4 tuần (BE `main`): các món của Tuần 1,
 * cùng thứ với ngày kế hoạch (user chốt 2026-11-06); thứ chưa có món ⇒ mảng rỗng.
 */
export const templateItemsForDate = (template, date) => {
  const items = template?.items || [];
  if (!hasTemplateDays(items)) return items;
  return items.filter((item) => item.weekNo === 1 && item.weekday === isoWeekday(date));
};

/** Món của mẫu → dạng món trong bản nháp kế hoạch tuần (khối của mẫu). */
export const templatePlanItems = (template, date) =>
  templateItemsForDate(template, date).map((item) => ({
    session: item.session,
    block: template.block,
    dishId: String(item.dishId),
    dishName: item.dishName || '',
    dishType: item.dishType || '',
  }));

/** Ngày đã có món của khối chưa: có thì hỏi trước khi thay bằng mẫu. */
export const dayBlockItemCount = (planDraft, date, block) =>
  (planDraft?.days.find((day) => day.date === date)?.items || []).filter((item) => item.block === block).length;

/** Thay món của khối mẫu trong một ngày bằng món của mẫu; khối khác, ngày nghỉ giữ nguyên. BE kiểm khi lưu. */
export const applyTemplateDay = (planDraft, date, template) => ({
  ...planDraft,
  days: planDraft.days.map((day) =>
    day.date !== date || day.off
      ? day
      : { ...day, items: [...day.items.filter((item) => item.block !== template.block), ...templatePlanItems(template, date)] },
  ),
});

/** Món của mẫu theo bữa: { [session]: items[] }. */
export const itemsBySession = (items = []) =>
  items.reduce((acc, item) => ({ ...acc, [item.session]: [...(acc[item.session] || []), item] }), {});

/** Form mẫu → body POST/PUT `/nutrition/menu-templates`. */
export const toTemplateRequest = (form) => ({
  name: String(form.name || '').trim(),
  seasonLabel: String(form.seasonLabel || '').trim(),
  block: form.block,
  // weekNo / weekday chỉ gửi khi món thuộc một ngày của bộ 4 tuần (BE hiện tại bắt buộc); mẫu một ngày không có
  items: form.items.map(({ session, dishId, weekNo, weekday }) => ({
    ...(weekNo != null ? { weekNo, weekday } : {}),
    session,
    dishId,
  })),
});

/*
 * Bộ mẫu theo ngày: BE trả món kèm `weekNo` (1–4) và `weekday` (1–5). Màn xem / sửa chỉ hiện một ngày của bộ
 * ("Tuần 2 · Thứ Tư"), không gộp mọi ngày vào một danh sách.
 */
export const DEFAULT_DAY = { weekNo: 1, weekday: 1 };
export const TEMPLATE_WEEKS = [1, 2, 3, 4];
export const TEMPLATE_WEEKDAYS = [1, 2, 3, 4, 5];

/** Món có gắn ngày (bộ 4 tuần) hay không; không thì mẫu là một ngày duy nhất. */
export const hasTemplateDays = (items = []) => items.some((item) => item.weekNo != null);

export const sameDay = (item, day) => !day || (item.weekNo === day.weekNo && item.weekday === day.weekday);

/** Món của đúng một ngày trong bộ; không chọn ngày thì giữ nguyên (mẫu một ngày). */
export const dayItems = (items = [], day) => items.filter((item) => sameDay(item, day));

/** Số món của từng ngày: { 'weekNo-weekday': n }, để đánh dấu ngày đã có món. */
export const dayCounts = (items = []) =>
  items.reduce((acc, item) => ({ ...acc, [`${item.weekNo}-${item.weekday}`]: (acc[`${item.weekNo}-${item.weekday}`] || 0) + 1 }), {});

/** Món của mẫu → body món của `POST /nutrition/menu-statistics` (tính dinh dưỡng một ngày cho một nhóm tuổi). */
export const toStatisticsItems = (items = []) => items.map(({ session, dishId }) => ({ session, dishId }));
