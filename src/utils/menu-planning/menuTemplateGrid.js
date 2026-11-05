/*
 * Thực đơn mẫu một ngày (BE NUT-13, user chốt 2026-11-04): mẫu = khối + nhãn mùa + các bữa → món.
 * Ở kế hoạch tuần, người lập chọn mẫu cho từng ngày; món của mẫu được điền vào bản nháp và vẫn sửa được từng món.
 */

/** Món của mẫu → dạng món trong bản nháp kế hoạch tuần (khối của mẫu). */
export const templatePlanItems = (template) =>
  (template?.items || []).map((item) => ({
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
      : { ...day, items: [...day.items.filter((item) => item.block !== template.block), ...templatePlanItems(template)] },
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
  items: form.items.map(({ session, dishId }) => ({ session, dishId })),
});

/** Món của mẫu → body món của `POST /nutrition/menu-statistics` (tính dinh dưỡng một ngày cho một nhóm tuổi). */
export const toStatisticsItems = (items = []) => items.map(({ session, dishId }) => ({ session, dishId }));
