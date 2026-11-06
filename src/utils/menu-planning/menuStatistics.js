/*
 * Chọn món một ngày để gửi BE thống kê (`POST /nutrition/menu-statistics`). Chỉ lọc theo khối/ngày của lưới đã có;
 * mọi số lượng, tiền, dinh dưỡng do BE tính.
 */

/** Khối chứa nhóm tuổi theo danh sách `blocks` BE trả cho kế hoạch tuần. */
export const blockOfAgeGroup = (blocks, ageGroupId) =>
  (blocks || []).find((b) => (b.ageGroupIds || []).some((id) => String(id) === String(ageGroupId)))?.block || null;

/** Món của khối nhóm tuổi trong ngày `date` của kế hoạch tuần; ngày nghỉ hoặc nhóm không thuộc khối nào ⇒ rỗng. */
export function planDayItems(plan, date, ageGroupId) {
  const block = blockOfAgeGroup(plan?.blocks, ageGroupId);
  const day = (plan?.days || []).find((d) => d.date === date);
  if (!block || !day || day.off) return [];
  return day.items.filter((i) => i.block === block).map((i) => ({ session: i.session, dishId: Number(i.dishId) }));
}

/** Món của bộ mẫu ở tuần `weekNo` (1–4), thứ `weekday` (1 = thứ Hai). */
export const templateDayItems = (template) => (template?.items || []).map((i) => ({ session: i.session, dishId: Number(i.dishId) }));

/** Lựa chọn nhóm tuổi theo id BE trả, tên lấy từ danh mục nhóm tuổi. */
export const ageGroupOptions = (ids, ageGroups) =>
  (ids || []).map((id) => ({
    id: String(id),
    name: (ageGroups || []).find((g) => String(g.id) === String(id))?.name || `Nhóm tuổi ${id}`,
  }));

/** Link mở trang thống kê từ kế hoạch tuần hoặc bộ mẫu. */
export const statisticsHref = (source) =>
  `/menu/statistics?${new URLSearchParams(Object.entries(source).filter(([, v]) => v != null && v !== '')).toString()}`;
