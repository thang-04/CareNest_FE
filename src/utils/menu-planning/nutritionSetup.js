import { AGE_GROUPS, ageGroupById } from '@/models/School';
import { MEAL_SESSION_LABELS, sessionsOf } from '@/models/menu-planning/menuPlanningConstants';
import { priceOn } from '@/utils/menu-planning/menuCalculations';

/** Năng lượng một ngày (kcal) — bắt buộc cùng cơ cấu P:L:G để đánh giá ngày (BE NUT-24). */
export const KCAL_NORM = { key: 'kcal', label: 'Năng lượng', unit: 'kcal' };
/** Cơ cấu áp dụng P:L:G: tỷ lệ năng lượng từ đạm, béo, bột đường (%). */
export const STRUCTURE_NORM_COLUMNS = [
  { key: 'protein', label: 'Đạm', unit: '%' },
  { key: 'lipid', label: 'Béo', unit: '%' },
  { key: 'glucid', label: 'Bột đường', unit: '%' },
];
/** Định mức gam / trẻ / ngày theo chất (BE NUT-24); chất nào để trống thì không đánh giá chất đó. */
export const GRAM_NORM_COLUMNS = [
  { key: 'animalProteinG', label: 'Đạm động vật', unit: 'g' },
  { key: 'plantProteinG', label: 'Đạm thực vật', unit: 'g' },
  { key: 'animalLipidG', label: 'Béo động vật', unit: 'g' },
  { key: 'plantLipidG', label: 'Béo thực vật', unit: 'g' },
  { key: 'glucidG', label: 'Bột đường', unit: 'g' },
];
/** Tỷ lệ năng lượng từng bữa gốc (% nhu cầu năng lượng cả ngày `dailyKcalNeed`, BE NUT-25). */
export const SESSION_NORM_KEYS = { MORNING: 'morningKcalPct', LUNCH: 'lunchKcalPct', AFTERNOON: 'afternoonKcalPct' };
export const ALL_NORM_COLUMNS = [
  KCAL_NORM,
  ...STRUCTURE_NORM_COLUMNS,
  ...GRAM_NORM_COLUMNS,
  ...Object.values(SESSION_NORM_KEYS).map((key) => ({ key, unit: '%' })),
];

// Khóa định mức cũ (trước khi khớp tên BE animalProteinPct*, animalLipidPct*) còn trong localStorage
const LEGACY_NORM_KEYS = { animalProteinShare: 'animalProteinPct', animalLipidShare: 'animalLipidPct' };
export const hasLegacyNormKeys = (norms) => Object.keys(norms || {}).some((k) => k in LEGACY_NORM_KEYS);
/** Đổi khóa định mức cũ sang khóa mới; khóa mới đã có thì giữ. */
export const migrateNormKeys = (norms = {}) =>
  Object.entries(norms).reduce((out, [k, range]) => {
    const key = LEGACY_NORM_KEYS[k] || k;
    if (!(key in out) || key === k) out[key] = range;
    return out;
  }, {});

/** Tên viết tắt nhóm tuổi dùng trong bảng (Nhà trẻ, MG bé, MG nhỡ, MG lớn). */
export const ageAbbr = (ageGroupId) => (ageGroupById(ageGroupId)?.shortName || ageGroupId).replace('Mẫu giáo', 'MG');

/** Nhóm tuổi đang bật ở Thiết lập; chưa có thiết lập thì là cả 4 nhóm. */
export const activeAgeGroups = (nutritionSetups = []) =>
  AGE_GROUPS.filter((g) => nutritionSetups.find((s) => s.ageGroupId === g.id)?.enabled !== false);

/** Bữa của nhóm tuổi theo Thiết lập [{ code, name }]; chưa có thiết lập thì là bữa gốc. */
export const mealsOf = (setups, ageGroupId) => {
  const meals = (setups || []).find((s) => s.ageGroupId === ageGroupId)?.meals;
  return meals?.length
    ? meals.map((m) => ({ code: m.code, name: m.name }))
    : sessionsOf(ageGroupId).map((code) => ({ code, name: MEAL_SESSION_LABELS[code] }));
};

export const mealCodesOf = (setups, ageGroupId) => mealsOf(setups, ageGroupId).map((m) => m.code);

/** Định mức áp cho phạm vi các bữa trường phục vụ của nhóm tuổi: chỉ giữ các bữa đã cấu hình khi so định mức. */
export const normScopeMeals = (meals, setups, ageGroupId) => {
  const codes = mealCodesOf(setups, ageGroupId);
  return (meals || []).filter((m) => codes.includes(m.session));
};

/** Tên bữa: theo nhóm tuổi nếu biết, không thì tìm ở mọi nhóm, cuối cùng là tên bữa gốc. */
export const mealLabel = (setups, ageGroupId, code) =>
  (ageGroupId && mealsOf(setups, ageGroupId).find((m) => m.code === code)?.name) ||
  (setups || []).flatMap((s) => s.meals || []).find((m) => m.code === code)?.name ||
  MEAL_SESSION_LABELS[code] ||
  code;

/** Bữa gốc của nhóm tuổi gắn với điểm danh/báo ăn: không xóa được, bữa thêm tính suất theo một bữa gốc. */
export const isBaseMeal = (ageGroupId, meal) => sessionsOf(ageGroupId).includes(meal.code);

/** Giá đang áp dụng hôm nay và giá đã hẹn áp dụng sau hôm nay (nếu có). */
export const priceStatus = (prices, ageGroupId, today) => ({
  current: priceOn(prices, ageGroupId, today),
  upcoming:
    (prices || [])
      .filter((p) => p.ageGroupId === ageGroupId && p.effectiveFrom > today)
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1))[0] || null,
});

/** Dữ liệu BE → form sửa (số để dạng chuỗi cho ô nhập). */
export const toSetupForm = (setups, today) => ({
  effectiveFrom: today,
  reason: '',
  basis: setups.find((s) => s.basis)?.basis || '',
  groups: setups.map((s) => ({
    ageGroupId: s.ageGroupId,
    name: ageGroupById(s.ageGroupId)?.name || s.ageGroupId,
    enabled: s.enabled,
    price: String(s.price ?? ''),
    meals: s.meals.map((m) => ({ code: m.code, name: m.name, countAs: m.countAs })),
    norms: Object.fromEntries(ALL_NORM_COLUMNS.map(({ key }) => [key, (s.norms?.[key] || ['', '']).map(String)])),
    dailyKcalNeed: String(s.dailyKcalNeed ?? ''),
  })),
});

/** Form → payload gửi BE. */
export const toSetupPayload = (form) => ({
  effectiveFrom: form.effectiveFrom,
  reason: form.reason.trim(),
  basis: form.basis.trim(),
  groups: form.groups.map((g) => ({
    ageGroupId: g.ageGroupId,
    enabled: g.enabled,
    price: g.price,
    meals: g.meals.map(({ code, name, countAs }) => ({ code, name: name.trim(), countAs })),
    norms: g.norms,
    dailyKcalNeed: g.dailyKcalNeed,
  })),
});
