/* Màn Cân đối khẩu phần: dựng thân yêu cầu và sắp dữ liệu BE trả để hiển thị; không tự tính dinh dưỡng, tiền, lượng mua. */

export const ROUNDING_STEPS = [0.1, 0.5, 1];

export const formatAmount = (value, digits = 2) =>
  value == null || value === '' ? '—' : Number(value).toLocaleString('vi-VN', { maximumFractionDigits: digits });

const lineInput = ({ ageGroupId, session, dishId, foodId, baseGrams, grams }) => ({
  ageGroupId,
  session,
  dishId,
  foodId,
  baseGrams,
  grams,
});

const sameCell = (a, b) => String(a.campusId) === String(b.campusId) && String(a.ageGroupId) === String(b.ageGroupId);

/**
 * Thân `preview` / `save` từ bản đang xem. `count` thay số trẻ một ô; `edits` sửa gam hoặc lượng mua. Sửa số làm bản hết
 * trạng thái đã làm tròn; `fromRecipe` bỏ các dòng đã sửa để BE dựng lại từ công thức.
 */
export const toBalanceRequest = (view, { count, edits = [], applyRounding = false, roundingStep, fromRecipe = false } = {}) => {
  const changed = !!count || edits.length > 0 || fromRecipe;
  return {
    version: view.version ?? null,
    counts: view.counts.map((c) => (count && sameCell(c, count) ? count : c)),
    lines: fromRecipe ? [] : view.lines.map(lineInput),
    edits,
    applyRounding,
    roundingStep: roundingStep ?? (changed ? null : (view.roundingStep ?? null)),
    fromRecipe,
  };
};

const VERDICTS = {
  OK: ['green', 'Đạt'],
  LOW: ['red', 'Thấp'],
  HIGH: ['red', 'Cao'],
  NA: ['gray', 'Chưa có định mức'],
  INCOMPLETE: ['orange', 'Thiếu số liệu'],
  NO_DISHES: ['orange', 'Chưa có món'],
};
const MONEY_LABELS = { LOW: 'Thiếu', HIGH: 'Vượt' };

/** Nhãn một kết luận BE trả; `kind` 'money' đổi Thấp / Cao thành Thiếu / Vượt. */
export const verdictOf = (status, kind) => {
  const [tone, label] = VERDICTS[status] || ['gray', 'Chưa chấm'];
  return { tone, label: (kind === 'money' && MONEY_LABELS[status]) || label };
};

export const balanceBlocks = (view) => [...new Set((view?.ageGroups || []).map((g) => g.block))];

export const childrenOfCampus = (counts, campusId) =>
  counts.filter((c) => String(c.campusId) === String(campusId)).reduce((sum, c) => sum + Number(c.children || 0), 0);

/** Dòng bảng thực phẩm của một nhóm tuổi: số của BE kèm thông tin thực phẩm và gam theo từng bữa. */
export const foodRowsOf = (view, ageGroupId) => {
  const foods = new Map(view.foods.map((f) => [String(f.foodId), f]));
  const group = view.groups.find((g) => String(g.ageGroupId) === String(ageGroupId));
  return (group?.rows || []).map((row) => ({
    ...foods.get(String(row.foodId)),
    ...row,
    meals: view.lines
      .filter((l) => String(l.ageGroupId) === String(ageGroupId) && String(l.foodId) === String(row.foodId))
      .map(({ session, dishName, grams }) => ({ session, dishName, grams })),
  }));
};

/** Món của một ngày kế hoạch theo từng bữa của khối. */
export const mealGroupsOf = (day, block, sessions) =>
  sessions.map((session) => ({
    session,
    items: (day?.items || []).filter((i) => i.block === block && i.session === session),
  }));

const NUTRIENT_KEYS = ['animalProtein', 'plantProtein', 'animalLipid', 'plantLipid', 'glucid', 'kcal'];
const RATIO_KEYS = { animalProtein: 'protein', animalLipid: 'lipid', glucid: 'glucid' };
// Cột gam trên bảng ↔ dòng định mức BE (định mức gam chỉ tham khảo)
const NORM_KEYS = {
  animalProtein: 'animalProteinG',
  plantProtein: 'plantProteinG',
  animalLipid: 'animalLipidG',
  plantLipid: 'plantLipidG',
  glucid: 'glucidG',
  kcal: 'kcal',
};
const range = (row, unit = '') =>
  row?.min == null || row?.max == null ? '—' : `${formatAmount(row.min)} – ${formatAmount(row.max)}${unit}`;
const percent = (value) => (value == null ? '—' : `${formatAmount(value, 1)}%`);

/**
 * Bảng dinh dưỡng một trẻ (bố cục PMS): tổng, định mức, tỷ lệ đạt, cơ cấu P:L:G và khoảng cơ cấu. Cột đạm, béo gộp
 * động vật + thực vật ở hai dòng cơ cấu (chỉ ghi ở cột động vật).
 */
export const nutritionTableOf = (evaluation) => {
  if (!evaluation) return [];
  const rows = new Map((evaluation.rows || []).map((r) => [r.key, r]));
  const build = (key, label, cell) => ({ key, label, ...Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, cell(k)])) });
  return [
    build('total', 'Tổng cộng', (k) => formatAmount(evaluation.totals?.[k])),
    build('norm', 'Định mức một ngày', (k) => range(rows.get(NORM_KEYS[k]))),
    build('attainment', 'Tỷ lệ đạt', (k) => {
      const value = rows.get(NORM_KEYS[k])?.attainment;
      return value == null ? '—' : `${value}%`;
    }),
    build('ratio', 'Tỷ lệ P:L:G', (k) => (RATIO_KEYS[k] ? percent(rows.get(RATIO_KEYS[k])?.percent) : '')),
    build('ratioNorm', 'Khoảng cho phép', (k) => (RATIO_KEYS[k] ? range(rows.get(RATIO_KEYS[k]), '%') : '')),
  ];
};

const num = (v) => (v == null || v === '' ? null : Number(v));

// Chênh tới mép gần nhất của khoảng đạt; trạng thái vẫn là kết luận BE trả, đây chỉ là số để người dùng biết sửa bao nhiêu
const gapOf = (value, min, max, status) => {
  if (value == null) return null;
  if (status === 'HIGH' && max != null) return Math.max(0, value - max);
  if (status === 'LOW' && min != null) return Math.max(0, min - value);
  return null;
};

// Thang hiển thị: khoảng đạt nằm giữa, rộng thêm mỗi bên một khoảng bằng chính nó và luôn chứa số thực tế
const scaleOf = (value, min, max) => {
  const span = max - min || Math.abs(max) * 0.2 || 1;
  const lo = Math.min(min - span, value ?? min);
  const hi = Math.max(max + span, value ?? max);
  const pad = (hi - lo) * 0.04;
  const at = (v) => Math.min(100, Math.max(0, ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100));
  return { value: value == null ? null : at(value), from: at(min), to: at(max) };
};

const gauge = ({ value, min, max, status }) => {
  const hasRange = value != null && min != null && max != null;
  return { value, min, max, status, gap: gapOf(value, min, max, status), scale: hasRange ? scaleOf(value, min, max) : null };
};

const RATIO_PARTS = [
  ['protein', 'Đạm'],
  ['lipid', 'Béo'],
  ['glucid', 'Đường'],
];

/**
 * Số cho thẻ "Kết quả cân đối" và thanh trạng thái: thực tế, khoảng đạt, chênh của Lượng (kcal), Chất (% P:L:G) và Tiền
 * (chi phí 1 trẻ trong ngân sách ± biên — cách BE chấm `moneyStatus`). Mọi số và trạng thái lấy từ evaluation BE trả.
 */
export const verdictGaugesOf = (evaluation) => {
  if (!evaluation) return null;
  const rows = new Map((evaluation.rows || []).map((r) => [r.key, r]));
  const kcal = rows.get('kcal');
  const budget = num(evaluation.foodBudget ?? evaluation.mealPrice);
  const tolerance = num(evaluation.budgetTolerancePct) ?? 0;
  return {
    quantity: gauge({
      value: num(kcal?.value ?? evaluation.totals?.kcal),
      min: num(kcal?.min),
      max: num(kcal?.max),
      status: evaluation.quantityStatus,
    }),
    quality: {
      status: evaluation.qualityStatus,
      parts: RATIO_PARTS.map(([key, label]) => {
        const row = rows.get(key);
        return { key, label, value: num(row?.percent), min: num(row?.min), max: num(row?.max), status: row?.status };
      }),
    },
    money: gauge({
      value: num(evaluation.cost),
      min: budget == null ? null : budget * (1 - tolerance / 100),
      max: budget == null ? null : budget * (1 + tolerance / 100),
      status: evaluation.moneyStatus,
    }),
  };
};

/** Lần tính thử vừa rồi đổi calo và chi phí 1 trẻ bao nhiêu; null khi chưa có lần trước hoặc không đổi. */
export const verdictDeltaOf = (current, previous) => {
  if (!current || !previous) return null;
  const kcalOf = (e) => num(e.totals?.kcal);
  const diff = (a, b) => (a == null || b == null ? null : a - b);
  const kcal = diff(kcalOf(current), kcalOf(previous));
  const cost = diff(num(current.cost), num(previous.cost));
  const changed = (v) => v != null && Math.abs(v) >= 0.05;
  return changed(kcal) || changed(cost) ? { kcal: changed(kcal) ? kcal : null, cost: changed(cost) ? cost : null } : null;
};

const OFF_DEFAULT = 'Ngày này không phục vụ bữa ăn.';

/**
 * Ngày nghỉ = kế hoạch tuần đánh dấu nghỉ hoặc BE báo nghỉ trong trạng thái cân đối (cuối tuần, lịch nghỉ của trường).
 * Lý do ưu tiên câu BE trả, rồi ghi chú của kế hoạch tuần.
 */
export const dayOffOf = (day, status) => {
  const off = !!day?.off || !!status?.dayOff;
  return { off, reason: off ? status?.offReason || (day?.off ? day.note : '') || OFF_DEFAULT : '' };
};

/** Dấu trên tab ngày theo trạng thái cân đối BE trả. */
export const dayMark = (status) => {
  if (!status) return '';
  if (status.dayOff) return ' · nghỉ';
  if (!status.saved) return ' ·';
  return status.passed ? ' ✓' : ' !';
};
