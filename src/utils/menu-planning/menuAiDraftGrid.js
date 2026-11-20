/*
 * Hàm thuần cho bảng gợi ý thực đơn sửa được (AI-02): lưới `cells` = { [ngày]: { [khóa ô]: { dishId, dishName, dishType } } }.
 * Ngày của mẫu ngày không có `date` ⇒ dùng khóa DAY_KEY. Số liệu và kiểm tra là của BE; ở đây chỉ dựng, đổi và so lưới.
 */
export const DAY_KEY = 'day';

const dayKey = (day) => day.date || DAY_KEY;
const sameDish = (a, b) => String(a?.dishId ?? '') === String(b?.dishId ?? '');

/** Lưới gốc từ nháp BE trả. */
export const cellsOf = (draft) =>
  Object.fromEntries(
    (draft?.days || [])
      .filter((day) => !day.off)
      .map((day) => [
        dayKey(day),
        Object.fromEntries(
          (day.items || []).map((item) => [
            item.slot,
            { dishId: String(item.dishId), dishName: item.dishName || '', dishType: item.dishType || '' },
          ]),
        ),
      ]),
  );

/** Cột của bảng theo thứ tự BE trả: [{ key, date, off, reason }]. */
export const columnsOf = (draft) =>
  (draft?.days || []).map((day) => ({ key: dayKey(day), date: day.date || null, off: !!day.off, reason: day.reason || '' }));

/** Hàng của bảng nhóm theo bữa: [{ session, slots: [{ key, session, index, dishTypes }] }]. */
export const sectionsOf = (slots) => {
  const sections = [];
  for (const slot of slots || []) {
    const last = sections[sections.length - 1];
    if (last && last.session === slot.session) last.slots.push(slot);
    else sections.push({ session: slot.session, slots: [slot] });
  }
  return sections;
};

const toDish = (dish) => ({
  dishId: String(dish.dishId),
  dishName: dish.dishName || '',
  dishType: dish.dishType || '',
});

/** Thay món của một ô; trả lưới mới. */
export const replaceCell = (cells, day, slot, dish) => ({
  ...cells,
  [day]: { ...(cells[day] || {}), [slot]: toDish(dish) },
});

/** Đổi món giữa hai ngày của cùng một hàng. */
export const swapCells = (cells, dayA, dayB, slot) => {
  const a = cells[dayA]?.[slot];
  const b = cells[dayB]?.[slot];
  if (!a || !b) return cells;
  return { ...cells, [dayA]: { ...cells[dayA], [slot]: b }, [dayB]: { ...cells[dayB], [slot]: a } };
};

/** Số ô khác gợi ý gốc. */
export const editedCount = (cells, original) =>
  Object.entries(cells).reduce(
    (total, [day, bySlot]) => total + Object.entries(bySlot).filter(([slot, dish]) => !sameDish(dish, original[day]?.[slot])).length,
    0,
  );

/** { [khóa ô]: món ứng viên[] } từ kết quả `candidates` của BE. */
export const candidatesBySlot = (candidates) => Object.fromEntries((candidates?.slots || []).map((slot) => [slot.key, slot.dishes || []]));

const sessionOf = (slot) => String(slot).split('.')[0];

/**
 * Món có thả được vào ô không (BE kiểm lại): thuộc ứng viên của ô hoặc là món gợi ý gốc của chính ô đó, và chưa nằm ở ô
 * khác của cùng bữa trong ngày. Trả '' khi được, ngược lại là lý do để báo người dùng.
 */
export const dropBlocker = ({ cells, original, bySlot, day, slot, dishId }) => {
  const id = String(dishId);
  const allowed = (bySlot[slot] || []).some((dish) => String(dish.dishId) === id) || String(original[day]?.[slot]?.dishId ?? '') === id;
  if (!allowed) return 'Món này không dùng được cho ô đã chọn';
  const clash = Object.entries(cells[day] || {}).some(
    ([other, dish]) => other !== slot && sessionOf(other) === sessionOf(slot) && String(dish.dishId) === id,
  );
  return clash ? 'Món này đã có ở ô khác của cùng bữa' : '';
};

/** Body gửi BE để chấm thử hoặc dùng nháp kèm chỉnh sửa. */
export const toGridRequest = (cells) => ({
  days: Object.entries(cells).map(([date, bySlot]) => ({
    date,
    items: Object.entries(bySlot).map(([slot, dish]) => ({ slot, dishId: Number(dish.dishId) })),
  })),
});

const BLOCKING = 'BLOCKING';

/** Lỗi chặn của một ngày (NUT-09) để gắn nhãn đầu cột. */
export const dayBlocking = (issues, date) => (issues || []).filter((issue) => issue.severity === BLOCKING && issue.date === date);

/**
 * Câu BE chứng minh món ứng viên không thể tới khoảng định mức năng lượng (tiêu chí KCAL_REACH): lỗi do định lượng/danh
 * mục nên đổi món không sửa được. Không có ⇒ chuỗi rỗng.
 */
export const dataLimitNote = (checks) =>
  (checks || []).find((check) => check.code === 'KCAL_REACH' && check.status === 'FAIL')?.detail || '';

export const SWAP_POOL_LIMIT = 12;
export const SWAP_SHOWN = 5;

/**
 * Món thử thay vào một ô khi giáo viên muốn đổi: ứng viên hợp lệ của ô, trừ món đang ở ô, giữ thứ tự ưu tiên của BE và cắt
 * còn tối đa `limit` món để số lần chấm thử không phình.
 */
export const swapPool = ({ cells, original, bySlot, day, slot, limit = SWAP_POOL_LIMIT }) => {
  const current = String(cells[day]?.[slot]?.dishId ?? '');
  return (bySlot[slot] || [])
    .filter((dish) => String(dish.dishId) !== current && !dropBlocker({ cells, original, bySlot, day, slot, dishId: dish.dishId }))
    .slice(0, limit);
};

/**
 * Kết quả BE chấm thử một món thay thành dòng để xếp hạng: số lỗi chặn của ngày đó, điểm cả tuần so với lưới đang sửa,
 * năng lượng cả ngày và trạng thái so định mức. FE chỉ đọc số BE đã tính (NUT-05).
 */
export const swapOutcome = ({ dish, result, date, baselineTotal, ageGroup }) => {
  const evaluation = (result?.evaluations || []).filter((e) => e.date === date);
  const picked = evaluation.find((e) => String(e.ageGroupId) === String(ageGroup?.id)) || evaluation[0];
  const kcal = (picked?.rows || []).find((row) => row.key === 'kcal');
  const total = result?.score?.total ?? null;
  return {
    dish,
    blocking: dayBlocking(result?.issues, date).length,
    total,
    delta: total != null && baselineTotal != null ? total - baselineTotal : null,
    kcal: kcal?.value ?? null,
    kcalStatus: kcal?.status || '',
  };
};

/** Xếp món thay: ít lỗi chặn của ngày trước, rồi điểm cao, rồi hợp mùa; món kho khô hết xuống cuối nhóm cùng kết quả. */
export const rankSwaps = (outcomes) =>
  [...outcomes].sort(
    (a, b) =>
      a.blocking - b.blocking ||
      (b.total ?? -1) - (a.total ?? -1) ||
      Number(!!a.dish.outOfStock) - Number(!!b.dish.outOfStock) ||
      Number(!!b.dish.seasonal) - Number(!!a.dish.seasonal),
  );

/** Số ngày còn lỗi chặn. */
export const unmetDays = (issues, columns) =>
  columns.filter((col) => !col.off && col.date && dayBlocking(issues, col.date).length > 0).length;

/** Thứ đã dùng món này trong tuần (trừ ô đang chọn) để gắn nhãn "đã dùng" ở cột món. */
export const usedDays = (cells, dishId, except) =>
  Object.entries(cells)
    .filter(([day, bySlot]) =>
      Object.entries(bySlot).some(
        ([slot, dish]) => String(dish.dishId) === String(dishId) && !(except && except.day === day && except.slot === slot),
      ),
    )
    .map(([day]) => day);

/** Danh sách món của cột bên phải: theo ô đang chọn, hoặc gộp mọi ô (không lặp) khi chưa chọn ô. */
export const paletteDishes = (candidates, slotKey) => {
  const slots = candidates?.slots || [];
  if (slotKey) return slots.find((slot) => slot.key === slotKey)?.dishes || [];
  const seen = new Set();
  return slots.flatMap((slot) => slot.dishes || []).filter((dish) => (seen.has(dish.dishId) ? false : seen.add(dish.dishId)));
};

// Cơ cấu P:L:G so định mức theo % năng lượng (BE NUT-24) ⇒ đọc `percent`; các dòng khác đọc `value`
const ENERGY_SHARE_KEYS = ['protein', 'lipid', 'glucid'];
const CORE_KEYS = ['kcal', ...ENERGY_SHARE_KEYS];
// Định lượng theo gam: chỉ thêm hàng khi có ngày lệch, để bảng không dài khi mọi thứ đạt
const GRAM_KEYS = ['animalProteinG', 'plantProteinG', 'animalLipidG', 'plantLipidG', 'glucidG'];
const isOff = (status) => status === 'LOW' || status === 'HIGH';

/**
 * Các hàng "dinh dưỡng cả ngày so với định mức" của bảng gợi ý, dựng từ `evaluations` BE trả: luôn có năng lượng và cơ
 * cấu đạm–béo–bột đường, thêm hàng định lượng gam nào có ngày lệch; vi chất không vào đây (chỉ cảnh báo). Mỗi ngày lấy
 * nhóm tuổi đang xem kcal, không có thì nhóm đầu. FE chỉ đọc số và trạng thái BE đã tính, không tự so định mức (NUT-05).
 */
export const nutritionRows = (evaluations, dates, ageGroup) => {
  const byDate = {};
  let ageGroupName = '';
  let groups = 0;
  for (const date of dates) {
    const ofDay = (evaluations || []).filter((e) => e.date === date);
    const evaluation = ofDay.find((e) => String(e.ageGroupId) === String(ageGroup?.id)) || ofDay[0];
    if (!evaluation) continue;
    byDate[date] = evaluation.rows || [];
    ageGroupName = ageGroupName || evaluation.ageGroupName || '';
    groups = Math.max(groups, ofDay.length);
  }
  const days = Object.keys(byDate);
  const find = (date, key) => byDate[date].find((row) => row.key === key);
  const keys = [
    ...CORE_KEYS.filter((key) => days.some((date) => find(date, key))),
    ...GRAM_KEYS.filter((key) => days.some((date) => isOff(find(date, key)?.status))),
  ];
  const rows = keys.map((key) => {
    const share = ENERGY_SHARE_KEYS.includes(key);
    // Định mức giống nhau giữa các ngày (cùng phiên bản cấu hình) ⇒ lấy ngày đầu có khoảng
    const norm = days.map((date) => find(date, key)).find((row) => row && (row.min != null || row.max != null));
    const cells = {};
    for (const date of days) {
      const row = find(date, key);
      if (row) cells[date] = { value: share ? row.percent : row.value, status: row.status };
    }
    return { key, share, min: norm?.min ?? null, max: norm?.max ?? null, cells };
  });
  return { ageGroupName, multiGroup: groups > 1, rows };
};
