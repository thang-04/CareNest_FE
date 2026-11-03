import { toPurchaseQuantity } from '@/utils/kitchen/stockUnits';
import { MEAL_BLOCK_ORDER, MEAL_SESSION_ORDER } from '@/models/kitchen/kitchenRecordConstants';

/*
 * Hiển thị dữ liệu "bếp hôm nay", lưu mẫu, khung giờ ảnh. Chỉ sắp xếp, gộp theo bữa và kiểm ô nhập; trạng thái, số suất,
 * lượng thực phẩm, quyền duyệt do BE trả và quyết định.
 */
const sessionRank = (session) => {
  const index = MEAL_SESSION_ORDER.indexOf(session);
  return index < 0 ? MEAL_SESSION_ORDER.length : index;
};
export const bySession = (a, b) => sessionRank(a.session) - sessionRank(b.session);

/** Bữa có món: [{ session, byBlock: { NURSERY: [dish], KINDERGARTEN: [dish] } }] theo thứ tự bữa trong ngày. */
export const menuBySession = (menu) => {
  const rows = new Map();
  for (const item of menu || []) {
    if (!rows.has(item.session)) rows.set(item.session, { session: item.session, byBlock: {} });
    rows.get(item.session).byBlock[item.menuBlock] = item.dishes || [];
  }
  return [...rows.values()].sort(bySession);
};

/** Khối có trong thực đơn ngày, theo thứ tự nhà trẻ → mẫu giáo. */
export const menuBlocks = (menu) => MEAL_BLOCK_ORDER.filter((block) => (menu || []).some((item) => item.menuBlock === block));

/** Suất đã xác nhận (BE trả theo lớp × bữa) nhóm theo bữa để hiện: [{ session, classes: [{ classroomName, normal, substitute }] }]. */
export const servingsBySession = (servings) => {
  const rows = new Map();
  for (const item of servings || []) {
    if (!rows.has(item.session)) rows.set(item.session, { session: item.session, classes: [] });
    rows.get(item.session).classes.push(item);
  }
  return [...rows.values()].sort(bySession);
};

/** Dòng lượng thực phẩm cần: số BE theo đơn vị gốc, thêm bản theo đơn vị mua để hiện; tươi trước khô, rồi theo tên. */
export const foodNeedRows = (foods) =>
  (foods || [])
    .map((need) => ({ ...need, purchaseQuantity: toPurchaseQuantity(need.quantity, need.food) }))
    .sort((a, b) =>
      a.storage === b.storage ? String(a.food?.name).localeCompare(String(b.food?.name), 'vi') : a.storage === 'FRESH' ? -1 : 1,
    );

/** Còn việc chờ duyệt: lưu mẫu chưa duyệt hoặc hủy mẫu đã ghi nhưng chưa duyệt (cùng nghĩa với số chờ duyệt ở hub). */
export const isPendingApproval = (sample) => sample?.status === 'RECORDED' || sample?.disposalStatus === 'RECORDED';

/** Việc duyệt kế tiếp của bản lưu mẫu: 'sample' | 'disposal' | null. Cờ `canApprove` do BE trả; BE vẫn kiểm lại khi duyệt. */
export const nextApproval = (sample) => {
  if (!sample?.canApprove) return null;
  if (sample.status === 'RECORDED') return 'sample';
  if (sample.disposalStatus === 'RECORDED') return 'disposal';
  return null;
};

/** Mẫu mới nhất trước: ngày, rồi bữa muộn trước, rồi giờ lấy mẫu. */
export const sortSamples = (samples) =>
  [...(samples || [])].sort(
    (a, b) =>
      String(b.date).localeCompare(String(a.date)) ||
      sessionRank(b.session) - sessionRank(a.session) ||
      String(b.sampledAt).localeCompare(String(a.sampledAt)),
  );

/** Bản lưu mẫu đã duyệt (in được biểu mẫu). */
export const printableSamples = (samples) => sortSamples(samples).filter((sample) => sample.status === 'APPROVED');

/** Ngày `days` ngày trước `isoDate` (yyyy-mm-dd). */
export const daysBefore = (isoDate, days) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const hhmm = (time) => String(time || '').slice(0, 5);

/** Khung giờ BE (có thể HH:mm:ss) -> ô nhập đủ ba bữa; bữa chưa cấu hình để trống. */
export const windowsToForm = (windows) =>
  MEAL_SESSION_ORDER.map((session) => {
    const found = (windows || []).find((w) => w.session === session);
    return { session, startTime: hhmm(found?.startTime), endTime: hhmm(found?.endTime), configured: !!found };
  });

/**
 * Kiểm ô nhập khung giờ, trả lỗi theo `windows.{i}.startTime|endTime`. Bữa để trống cả hai ô = không đổi (không gửi);
 * điền một ô thì phải đủ hai ô, đúng HH:mm và giờ bắt đầu trước giờ kết thúc.
 */
export const validateWindowsForm = (form) => {
  const errors = {};
  form.forEach((row, i) => {
    const start = row.startTime;
    const end = row.endTime;
    if (!start && !end) return;
    if (!HHMM.test(start || '')) errors[`windows.${i}.startTime`] = 'Nhập giờ bắt đầu dạng HH:mm';
    if (!HHMM.test(end || '')) errors[`windows.${i}.endTime`] = 'Nhập giờ kết thúc dạng HH:mm';
    if (!errors[`windows.${i}.startTime`] && !errors[`windows.${i}.endTime`] && start >= end)
      errors[`windows.${i}.endTime`] = 'Giờ kết thúc phải sau giờ bắt đầu';
  });
  return errors;
};

/** Ô nhập -> body `PUT /meal-photo-windows`; chỉ gửi bữa đã điền. */
export const toWindowsRequest = (form) => ({
  windows: form
    .filter((row) => row.startTime && row.endTime)
    .map((row) => ({ session: row.session, startTime: row.startTime, endTime: row.endTime })),
});
