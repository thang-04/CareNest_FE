import { beClient } from '@/services/http/beClient';
import { writeDb } from '@/mocks/mockDatabase';

/*
 * Dev (VITE_SCHOOL_CONFIG_API): bếp chưa có BE (thực đơn, định lượng, kho vẫn mock). Lấy sổ báo ăn HT/PHT đã xác nhận
 * từ BE (GET /meal-counts) rồi chép vào CSDL mock của bếp, để phần tính định lượng theo thực đơn đã công bố dùng số thật.
 * Nhóm tuổi BE (id số) đổi sang mã nhóm tuổi của thực đơn mock (ag-3...) qua GET /age-groups.
 */
let ageGroupCodes = null;
const synced = new Map(); // date -> chữ ký sổ đã chép lần trước
const loadAgeGroupCodes = async () => {
  if (!ageGroupCodes) {
    const groups = await beClient.get('/age-groups');
    ageGroupCodes = Object.fromEntries((groups || []).map((g) => [String(g.id), g.code]));
  }
  return ageGroupCodes;
};

const toKitchenCount = (count, codes) => ({
  id: `be-${count.id}`,
  source: 'BE',
  campusId: count.campusId,
  date: count.date,
  session: count.session,
  status: count.status,
  confirmedAt: count.confirmedAt,
  confirmedBy: count.confirmedBy,
  classes: count.classes.map((line) => ({
    classId: line.classId,
    className: line.className,
    ageGroupId: codes[line.ageGroupId] || null,
    normal: line.normal,
    substitute: line.substitute,
  })),
  adjustments: [],
  history: [],
});

/** Đồng bộ sổ đã xác nhận của một ngày; bếp chỉ nhận bữa CONFIRMED (BE đã lọc theo vai trò). */
export async function syncBeMealCounts(date) {
  if (!date) return;
  const [day, codes] = await Promise.all([beClient.get('/meal-counts', { params: { date } }), loadAgeGroupCodes()]);
  const confirmed = (day?.counts || [])
    .filter((count) => count.id && count.status === 'CONFIRMED')
    .map((count) => toKitchenCount(count, codes));
  // Chỉ ghi khi số đổi: ghi CSDL mock phát sự kiện đổi dữ liệu, màn bếp tải lại ⇒ ghi mỗi lần sẽ lặp vô hạn
  const signature = JSON.stringify(confirmed);
  if (synced.get(date) === signature) return;
  synced.set(date, signature);
  writeDb((db) => {
    db.mealCounts = (db.mealCounts || []).filter((m) => !(m.source === 'BE' && m.date === date));
    db.mealCounts.push(...confirmed);
  });
}
