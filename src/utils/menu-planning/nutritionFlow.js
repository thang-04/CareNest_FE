import { RECORD_STATUS, WEEKLY_STATUS, addDays, mondayOf } from '@/models/menu-planning/menuPlanningConstants';
import { priceOn } from '@/utils/menu-planning/menuCalculations';
import { activeAgeGroups } from '@/utils/menu-planning/nutritionSetup';

/** Các bước của luồng dinh dưỡng, theo thứ tự trang Quy trình. */
export const FLOW_STEPS = [
  { key: 'setup', label: 'Thiết lập thông tin dinh dưỡng', to: '/menu/setup' },
  { key: 'foods', label: 'Chọn thực phẩm', to: '/menu/foods' },
  { key: 'dishes', label: 'Tạo món ăn', to: '/menu/dishes' },
  { key: 'menus', label: 'Tạo thực đơn mẫu', to: '/menu/menus' },
  { key: 'weekly', label: 'Xếp thực đơn tuần', to: '/menu/weekly' },
  { key: 'market', label: 'Khẩu phần & đi chợ', to: '/kitchen/required-quantity' },
];

const isActive = (x) => x.status !== RECORD_STATUS.INACTIVE;
const missingFoodData = (f) => f.unitPrice == null || Object.values(f.nutrition || {}).some((v) => v == null);

/**
 * Tóm tắt từng bước từ dữ liệu đang có, chỉ để nhắc việc trên trang Quy trình.
 * tone: 'ok' | 'warn' | 'info' | null (bước không có trạng thái riêng).
 */
export function flowSummary({ mealPrices = [], nutritionSetups = [], foods = [], dishes = [], menus = [], weeklyMenus = [], today }) {
  const groups = activeAgeGroups(nutritionSetups);
  const unpriced = groups.filter((g) => !priceOn(mealPrices, g.id, today)).length;
  const activeFoods = foods.filter(isActive);
  const foodGaps = activeFoods.filter(missingFoodData).length;
  const activeDishes = dishes.filter(isActive);
  const emptyDishes = activeDishes.filter((d) => !d.ingredients?.length).length;
  const activeMenus = menus.filter(isActive).length;

  const nextWeek = addDays(mondayOf(today), 7);
  const ofNextWeek = weeklyMenus.filter((w) => w.weekStart === nextWeek);
  const published = new Set(
    ofNextWeek.filter((w) => w.status === WEEKLY_STATUS.PUBLISHED && groups.some((g) => g.id === w.ageGroupId)).map((w) => w.ageGroupId),
  ).size;
  const drafts = ofNextWeek.filter((w) => w.status === WEEKLY_STATUS.DRAFT).length;
  const week = `Tuần ${nextWeek.slice(8, 10)}/${nextWeek.slice(5, 7)}`;

  return {
    setup: unpriced
      ? { tone: 'warn', text: `${unpriced} nhóm tuổi chưa có giá suất ăn` }
      : { tone: 'ok', text: `${groups.length} nhóm tuổi đang áp dụng` },
    foods: foodGaps
      ? { tone: 'warn', text: `${foodGaps} thực phẩm thiếu đơn giá hoặc dinh dưỡng` }
      : { tone: 'ok', text: `${activeFoods.length} thực phẩm đủ số liệu` },
    dishes: emptyDishes
      ? { tone: 'warn', text: `${emptyDishes} món chưa có thành phần` }
      : { tone: 'ok', text: `${activeDishes.length} món đang dùng` },
    menus: activeMenus ? { tone: 'ok', text: `${activeMenus} thực đơn mẫu` } : { tone: 'warn', text: 'Chưa có thực đơn mẫu' },
    weekly:
      published === groups.length
        ? { tone: 'ok', text: `${week}: đã xuất bản` }
        : drafts
          ? { tone: 'info', text: `${week}: ${drafts} bản nháp chờ xuất bản` }
          : published
            ? { tone: 'warn', text: `${week}: mới xuất bản ${published}/${groups.length} nhóm tuổi` }
            : { tone: 'warn', text: `${week}: chưa soạn` },
    market: { tone: null, text: 'Tính từ số suất đã chốt' },
  };
}
