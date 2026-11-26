import { dayLabel } from '@/utils/menu-planning/menuChecks';
import { LUNCH_LABELS, LUNCH_TYPES } from '@/utils/menu-planning/weekGridLayout';
import { mondayOf, schoolWeekStart, SESSION_ORDER } from '@/models/menu-planning/menuPlanningConstants';
import { isIsoDate } from '@/utils/format';

/*
 * Lưới kế hoạch tuần theo khối (nhà trẻ / mẫu giáo) ↔ body PUT /nutrition/meal-plans/{weekStart}. Bản nháp trên màn
 * giữ đúng dạng BE nhận: days[{ date, off, note, items[{ session, block, dishId }]}]; thêm dishName, dishType để hiện tên
 * món đã chọn, các trường này không gửi đi. Đánh giá dinh dưỡng, lỗi chặn do BE tính, màn chỉ nhóm lại để hiển thị.
 */
const text = (v) => (v == null ? '' : String(v).trim());

/** Tuần hợp lệ (thứ Hai) từ tham số URL; thiếu hoặc sai ngày thì lấy tuần học đang chạy của `today`. */
export const resolveWeekStart = (value, today) => (isIsoDate(value) ? mondayOf(value) : schoolWeekStart(today));

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

/** Ngày đã sửa -> body PUT .../days/{date}/amend (cả ngày, mọi khối) kèm lý do. */
export const toAmendRequest = (day, reason) => ({
  note: text(day.note),
  items: day.items.map(({ session, block, dishId }) => ({ session, block, dishId })),
  reason: text(reason),
});

/**
 * So món trước/sau của một lần sửa (hoặc của ngày đang sửa) theo khối × bữa, chỉ giữ ô có đổi:
 * [{ block, session, before: [tên món], after: [tên món] }]. Chỉ để hiển thị.
 */
export const dayItemChanges = (beforeItems = [], afterItems = []) => {
  const cells = new Map();
  const put = (side) => (item) => {
    const key = `${item.block}|${item.session}`;
    if (!cells.has(key)) cells.set(key, { block: item.block, session: item.session, before: [], after: [] });
    cells.get(key)[side].push(item.dishName || `Món #${item.dishId}`);
  };
  beforeItems.forEach(put('before'));
  afterItems.forEach(put('after'));
  const sameDishes = (a, b) => [...a].sort().join('|') === [...b].sort().join('|');
  return [...cells.values()]
    .filter((cell) => !sameDishes(cell.before, cell.after))
    .sort((a, b) => a.block.localeCompare(b.block) || SESSION_ORDER.indexOf(a.session) - SESSION_ORDER.indexOf(b.session));
};

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

/** Thay một món trong ô bằng món khác, giữ đúng vị trí; món mới đã có trong ô thì không đổi gì. */
export const replaceDish = (draft, date, block, session, oldId, dish) =>
  updateDay(draft, date, (day) => {
    const inCell = (item) => item.block === block && item.session === session;
    if (day.items.some((item) => inCell(item) && item.dishId === String(dish.id))) return day;
    return {
      ...day,
      items: day.items.map((item) =>
        inCell(item) && item.dishId === String(oldId)
          ? { ...item, dishId: String(dish.id), dishName: dish.name || '', dishType: dish.type || '' }
          : item,
      ),
    };
  });

/** Món của một khối trong ngày (mọi bữa), theo thứ tự đang có. */
export const dayBlockItems = (day, block) => (day?.items || []).filter((item) => item.block === block);

/** Ghi đè món của một khối trong ngày bằng `items`; món của khối khác giữ nguyên. */
export const setDayBlockItems = (draft, date, block, items) =>
  updateDay(draft, date, (day) => ({
    ...day,
    items: [...day.items.filter((item) => item.block !== block), ...items.map((item) => ({ ...item, block }))],
  }));

/** Chép món của một khối từ ngày `from` sang một hoặc nhiều ngày `to` (thay món khối đó ở từng ngày đích). */
export const copyDay = (draft, from, to, block) => {
  const items = dayBlockItems(
    draft.days.find((day) => day.date === from),
    block,
  );
  return [].concat(to).reduce((next, date) => setDayBlockItems(next, date, block, items), draft);
};

/** Link mở một ngày của một khối ở màn Cân đối khẩu phần. */
export const balanceHref = ({ week, block, date }) =>
  `/menu/nutrition?${new URLSearchParams(Object.entries({ week, block, date }).filter(([, v]) => v)).toString()}`;

/** Thân `POST /nutrition/menu-statistics` cho món đang chọn của một ngày và một nhóm tuổi; chưa có món ⇒ null (không gọi). */
export const dayStatisticsQuery = (items, ageGroupId, date) =>
  ageGroupId && items?.length
    ? {
        ageGroupId: Number(ageGroupId),
        ...(date ? { date } : {}),
        items: items.map(({ session, dishId }) => ({ session, dishId: Number(dishId) })),
      }
    : null;

// Bật ngày nghỉ giữ nguyên món đã chọn để bỏ nghỉ thì khôi phục; yêu cầu gửi đi không mang món của ngày nghỉ
export const setDayOff = (draft, date, off) => updateDay(draft, date, (day) => ({ ...day, off: !!off }));
export const setDayNote = (draft, date, note) => updateDay(draft, date, (day) => ({ ...day, note }));

/** Ngày của bản nháp rơi vào đợt nghỉ năm học (SCH-05): { [date]: tên đợt nghỉ }. */
export const holidayNames = (draft, holidays = []) =>
  Object.fromEntries(
    (draft?.days || [])
      .map((day) => [day.date, holidays.find((h) => h.startDate <= day.date && h.endDate >= day.date)?.name])
      .filter(([, name]) => name),
  );

/** Tự đánh dấu nghỉ các ngày trùng đợt nghỉ năm học; lý do trống thì điền tên đợt nghỉ. Không có gì đổi ⇒ trả lại `draft`. */
export const applyHolidays = (draft, names) => {
  if (!draft || !Object.keys(names || {}).some((date) => draft.days.some((d) => d.date === date && !d.off))) return draft;
  return {
    days: draft.days.map((day) =>
      names[day.date] && !day.off ? { ...day, off: true, note: text(day.note) ? day.note : names[day.date] } : day,
    ),
  };
};

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

/* ---------- đồng bộ bữa chung giữa các khối ---------- */
/** Bữa mà cả hai khối cùng ăn. */
export const sharedSessions = (plan, block, other) =>
  blockSessions(plan, block).filter((session) => blockSessions(plan, other).includes(session));

const cellKey = (day, block, session) =>
  cellItems(day, block, session)
    .map((item) => item.dishId)
    .join(',');

/** Ô bữa chung của `block` đổi giữa `before` và `after` (thêm, đổi, xóa món) thì ghi đè ô cùng ngày, cùng bữa của khối khác. */
export const syncSharedMeals = (before, after, plan, block) =>
  planBlocks(plan)
    .filter((other) => other !== block)
    .reduce((draft, other) => {
      const shared = sharedSessions(plan, block, other);
      return {
        days: draft.days.map((day) => {
          const prev = before.days.find((d) => d.date === day.date);
          const changed = shared.filter((session) => cellKey(prev, block, session) !== cellKey(day, block, session));
          if (!changed.length) return day;
          const kept = day.items.filter((item) => !(item.block === other && changed.includes(item.session)));
          const copied = changed.flatMap((session) => cellItems(day, block, session).map((item) => ({ ...item, block: other })));
          return { ...day, items: [...kept, ...copied] };
        }),
      };
    }, after);

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
