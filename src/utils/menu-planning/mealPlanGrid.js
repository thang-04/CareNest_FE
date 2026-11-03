import { dayLabel } from '@/utils/menu-planning/menuChecks';
import { LUNCH_LABELS, LUNCH_TYPES } from '@/utils/menu-planning/weekGridLayout';
import { mondayOf, SESSION_ORDER } from '@/models/menu-planning/menuPlanningConstants';
import { isIsoDate } from '@/utils/format';

/*
 * Lưới kế hoạch tuần theo khối (nhà trẻ / mẫu giáo) ↔ body PUT /nutrition/meal-plans/{weekStart}. Bản nháp trên màn
 * giữ đúng dạng BE nhận: days[{ date, off, note, items[{ session, block, dishId }]}]; thêm dishName, dishType để hiện tên
 * món đã chọn, các trường này không gửi đi. Đánh giá dinh dưỡng, lỗi chặn do BE tính, màn chỉ nhóm lại để hiển thị.
 */
const text = (v) => (v == null ? '' : String(v).trim());

/** Tuần hợp lệ (thứ Hai) từ tham số URL; thiếu hoặc sai ngày thì lấy tuần của `today`. */
export const resolveWeekStart = (value, today) => (isIsoDate(value) ? mondayOf(value) : mondayOf(today));

/** Kế hoạch BE -> bản nháp đang sửa. */
export const draftFromPlan = (plan) => ({
  days: (plan?.days || []).map((day) => ({
    date: day.date,
    off: !!day.off,
    note: day.note || '',
    items: (day.items || []).map((item) => ({
      session: item.session,
      block: item.block,
      dishId: String(item.dishId),
      dishName: item.dishName || '',
      dishType: item.dishType || '',
    })),
  })),
});

/** Bản nháp -> body PUT (ghi đè cả lưới). Ngày nghỉ không mang món. */
export const toPlanRequest = (draft) => ({
  days: draft.days.map((day) => ({
    date: day.date,
    off: !!day.off,
    note: text(day.note),
    items: day.off ? [] : day.items.map(({ session, block, dishId }) => ({ session, block, dishId })),
  })),
});

/** Có thay đổi chưa lưu so với bản đã lưu (so nội dung sẽ gửi, bỏ qua món của ngày nghỉ). */
export const isDirty = (draft, saved) => JSON.stringify(toPlanRequest(draft)) !== JSON.stringify(toPlanRequest(saved));

/**
 * Bố cục bảng tuần như sổ thực đơn: mỗi bữa một dải tiêu đề; bữa trưa tách hàng theo loại món (Cơm, Món mặn, Canh, Món rau,
 * Tráng miệng; món loại khác vào hàng "Món khác"), bữa khác một hàng "Món". keepEmpty=false (chỉ xem): ẩn loại món cả tuần
 * không dùng.
 */
export const gridSections = (draft, block, sessions, { keepEmpty = true } = {}) =>
  sessions.map((session) => {
    if (session !== 'LUNCH') return { session, rows: [{ key: session, label: 'Món', type: null }] };
    const used = new Set((draft?.days || []).flatMap((day) => cellItems(day, block, session)).map((item) => item.dishType));
    const rows = LUNCH_TYPES.filter((type) => keepEmpty || used.has(type)).map((type) => ({
      key: `LUNCH|${type}`,
      label: LUNCH_LABELS[type],
      type,
    }));
    if ([...used].some((type) => !LUNCH_TYPES.includes(type))) rows.push({ key: 'LUNCH|OTHER', label: 'Món khác', type: 'OTHER' });
    return { session, rows: rows.length ? rows : [{ key: session, label: 'Món', type: null }] };
  });

/** Món của một hàng: hàng theo loại món chỉ lấy món đúng loại; hàng "Món khác" lấy loại ngoài danh sách bữa trưa. */
export const rowItems = (day, block, session, row) =>
  cellItems(day, block, session).filter((item) =>
    !row.type ? true : row.type === 'OTHER' ? !LUNCH_TYPES.includes(item.dishType) : item.dishType === row.type,
  );

/** Nhãn đầu cột theo kết quả BE đã lưu: số lỗi chặn + cảnh báo của ngày; không có gì và ngày đã được kiểm ⇒ "Đạt". */
export const dayResult = (plan, date) => {
  const issues = (plan?.issues || []).filter((i) => i.date === date && (i.severity === 'BLOCKING' || i.severity === 'WARNING'));
  if (issues.length) return { tone: issues.some((i) => i.severity === 'BLOCKING') ? 'red' : 'orange', label: `${issues.length} lưu ý` };
  return (plan?.evaluations || []).some((e) => e.date === date) ? { tone: 'green', label: 'Đạt' } : null;
};

/** Hàng "Suất dị ứng": món trong ngày (khối đang xem) có chất gây dị ứng theo danh mục món — chỉ hiển thị. */
export const dayAllergenNotes = (day, block, dishById) =>
  (day?.items || [])
    .filter((item) => item.block === block)
    .map((item) => ({ item, allergens: dishById[item.dishId]?.allergens || [] }))
    .filter(({ allergens }) => allergens.length > 0)
    .map(({ item, allergens }) => ({ key: `${item.session}|${item.dishId}`, dish: item.dishName, allergens }));

const updateDay = (draft, date, fn) => ({ days: draft.days.map((day) => (day.date === date ? fn(day) : day)) });

export const cellItems = (day, block, session) => (day?.items || []).filter((item) => item.block === block && item.session === session);

/** Thêm món vào ô (khối, bữa) của một ngày; món đã có trong ô thì bỏ qua. */
export const addDish = (draft, date, block, session, dish) =>
  updateDay(draft, date, (day) =>
    day.items.some((item) => item.block === block && item.session === session && item.dishId === String(dish.id))
      ? day
      : {
          ...day,
          items: [...day.items, { session, block, dishId: String(dish.id), dishName: dish.name || '', dishType: dish.type || '' }],
        },
  );

export const removeDish = (draft, date, block, session, dishId) =>
  updateDay(draft, date, (day) => ({
    ...day,
    items: day.items.filter((item) => !(item.block === block && item.session === session && item.dishId === String(dishId))),
  }));

// Bật ngày nghỉ giữ nguyên món đã chọn để bỏ nghỉ thì khôi phục; yêu cầu gửi đi không mang món của ngày nghỉ
export const setDayOff = (draft, date, off) => updateDay(draft, date, (day) => ({ ...day, off: !!off }));
export const setDayNote = (draft, date, note) => updateDay(draft, date, (day) => ({ ...day, note }));

/* ---------- cấu trúc khối / bữa / đánh giá do BE trả ---------- */
export const planBlocks = (plan) => (plan?.blocks || []).map((b) => b.block);

/** Bữa của khối theo thứ tự trong ngày. */
export const blockSessions = (plan, block) => {
  const found = (plan?.blocks || []).find((b) => b.block === block);
  return SESSION_ORDER.filter((session) => found?.sessions?.includes(session));
};

/** Đánh giá của khối gom theo nhóm tuổi: [{ ageGroupId, ageGroupName, byDate: { [date]: evaluation } }]. */
export const evaluationGroups = (plan, block) => {
  const groups = new Map();
  (plan?.evaluations || [])
    .filter((e) => e.block === block)
    .forEach((e) => {
      const key = String(e.ageGroupId);
      if (!groups.has(key)) groups.set(key, { ageGroupId: key, ageGroupName: e.ageGroupName, byDate: {} });
      groups.get(key).byDate[e.date] = e;
    });
  return [...groups.values()];
};

/* ---------- lỗi / cảnh báo công bố ---------- */
const SEVERITY_ORDER = ['BLOCKING', 'WARNING', 'INFO'];

export const issuesBySeverity = (issues = []) => ({
  blocking: issues.filter((i) => i.severity === 'BLOCKING'),
  warning: issues.filter((i) => i.severity === 'WARNING'),
  info: issues.filter((i) => i.severity === 'INFO'),
});

/** Gom theo ngày (thứ tự ngày); lỗi không gắn ngày xếp cuối với nhãn "Cả tuần". Trong ngày: lỗi chặn trước. */
export const groupIssuesByDate = (issues = []) => {
  const byDate = new Map();
  issues.forEach((issue) => {
    const key = issue.date || '';
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(issue);
  });
  return [...byDate.entries()]
    .sort(([a], [b]) => (a && b ? a.localeCompare(b) : a ? -1 : b ? 1 : 0))
    .map(([date, list]) => ({
      date,
      label: date ? dayLabel(date) : 'Cả tuần',
      issues: [...list].sort((x, y) => SEVERITY_ORDER.indexOf(x.severity) - SEVERITY_ORDER.indexOf(y.severity)),
    }));
};
