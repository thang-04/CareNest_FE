import { computeMarket, purchaseStep } from '@/services/kitchen/mock/marketList';
import { addDays, defaultStorageOf } from '@/models/menu-planning/menuPlanningConstants';
import { activeKitchenClasses, classMealSessions, mealSessionsForCampus } from './attendanceSource';

/*
 * Dự trù tuần (khảo sát 18/10/2026, S1): số suất dự kiến từng lớp từng ngày × định lượng của thực đơn tuần đã xuất bản
 * ⇒ phiếu đặt hàng tuần (tươi theo ngày giao, khô = cần cho các ngày chưa chốt − tồn). Ngày đã chốt dùng số chốt thật.
 * Sau khi gửi NCC, mọi chênh lệch so với số đã báo NCC thành dòng "Báo NCC thay đổi". BE phải tính lại giống vậy.
 */

const r3 = (n) => Math.round(n * 1000) / 1000;
const roundUp = (qty, step) => r3(Math.ceil(Math.round((qty / step) * 1e6) / 1e6) * step);
const isAbsent = (status) => status === 'EXCUSED' || status === 'UNEXCUSED';

export const storageOf = (food) => food?.storage || defaultStorageOf(food?.group);
export const weekDays = (weekStart) => [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));

const confirmedOf = (counts, sessions) => sessions.length > 0 && sessions.every((s) => counts[s]?.status === 'CONFIRMED');

// Một cờ tham gia ăn áp dụng cho mọi bữa của nhóm tuổi, không đọc childMealPlans cũ.
const forecastCounts = (db, classes, sessions, valueOf) =>
  Object.fromEntries(
    sessions.map((session) => [
      session,
      {
        status: 'CONFIRMED',
        classes: classes
          .filter((cls) => classMealSessions(db, cls).includes(session))
          .map((cls) => ({ classId: cls.id, normal: valueOf(cls.id), substitute: 0 })),
      },
    ]),
  );

/**
 * Dữ liệu tuần của một cơ sở. ctx: { today, isSchoolDay(date), mealCountOf(date, session), stockOf(foodId) }.
 * record: bản dự trù đã lưu `{ cells: {classId: {date: n}}, sentAt, sentBy, sentOrder: {date: {foodId: qty}}, sentTotals, notices }`.
 */
export function buildWeeklyForecast(db, { campusId, weekStart, record, ctx }) {
  const classes = activeKitchenClasses(db, campusId);
  const sessions = mealSessionsForCampus(db, campusId);
  const classById = Object.fromEntries((db.classes || []).map((c) => [c.id, c]));
  const foodById = Object.fromEntries((db.foods || []).map((f) => [f.id, f]));
  const active = (db.children || []).filter((ch) => ch.status === 'ACTIVE' && ch.classId);
  const registered = Object.fromEntries(classes.map((c) => [c.id, active.filter((ch) => ch.classId === c.id).length]));
  const cells = record?.cells || {};

  const days = weekDays(weekStart).map((date) => {
    const holiday = !ctx.isSchoolDay(date);
    const counts = Object.fromEntries(sessions.map((s) => [s, holiday ? null : ctx.mealCountOf(date, s)]));
    const confirmed = !holiday && confirmedOf(counts, sessions);
    const chot = Object.fromEntries(
      classes.map((cls) => {
        const meals = classMealSessions(db, cls);
        const base = meals.includes('LUNCH') ? 'LUNCH' : meals[0];
        const row = counts[base]?.classes?.find((line) => line.classId === cls.id);
        return [cls.id, Number(row?.normal || 0) + Number(row?.substitute || 0)];
      }),
    );
    // Nghỉ đã báo: bản ghi vắng đã có cho ngày đó (GV điểm danh hoặc báo trước)
    const absent = {};
    (db.attendance || []).forEach((a) => {
      const cls = classes.find((item) => item.id === a.classId);
      const noMeal = cls && a.meals && classMealSessions(db, cls).every((session) => !a.meals[session]);
      if (a.date === date && a.campusId === campusId && (isAbsent(a.status) || noMeal)) absent[a.classId] = (absent[a.classId] || 0) + 1;
    });
    const suggested = (classId) => Math.max(0, (registered[classId] || 0) - (absent[classId] || 0));
    const valueOf = (classId) => {
      if (holiday) return 0;
      if (confirmed) return chot[classId] || 0;
      const saved = cells[classId]?.[date];
      return saved == null ? suggested(classId) : saved;
    };
    const market = holiday
      ? null
      : computeMarket(db, { date, counts: confirmed ? counts : forecastCounts(db, classes, sessions, valueOf), classById });
    return {
      date,
      holiday,
      hasMenu: !!market && market.status !== 'NO_MENU',
      confirmed,
      confirmedAt: confirmed
        ? sessions
            .map((session) => counts[session]?.confirmedAt)
            .filter(Boolean)
            .sort()
            .at(-1) || null
        : null,
      editable: !holiday && !confirmed && date >= ctx.today,
      suggested,
      valueOf,
      market,
    };
  });

  const outDays = days.map((d) => ({
    date: d.date,
    holiday: d.holiday,
    hasMenu: d.hasMenu,
    confirmed: d.confirmed,
    confirmedAt: d.confirmedAt,
    editable: d.editable,
    total: classes.reduce((n, c) => n + d.valueOf(c.id), 0),
    suggestedTotal: d.holiday ? 0 : classes.reduce((n, c) => n + d.suggested(c.id), 0),
    sentTotal: record?.sentTotals?.[d.date] ?? null,
  }));

  const outClasses = classes.map((c) => ({
    classId: c.id,
    className: c.name,
    registered: registered[c.id] || 0,
    cells: days.map((d) => {
      const value = d.valueOf(c.id);
      const suggested = d.holiday ? 0 : d.suggested(c.id);
      return { date: d.date, value, suggested, edited: !d.confirmed && cells[c.id]?.[d.date] != null && value !== suggested };
    }),
  }));

  // Lượng mua theo ngày, chia tươi / khô
  const buy = {};
  days.forEach((d) =>
    (d.market?.foods || []).forEach((f) => {
      if (!(f.buyUnits > 0)) return;
      buy[f.foodId] ||= { foodId: f.foodId, name: f.name, unit: f.purchaseUnit, storage: storageOf(foodById[f.foodId]), byDate: {} };
      buy[f.foodId].byDate[d.date] = f.buyUnits;
    }),
  );
  const sentOrder = record?.sentOrder || {};
  // Thực phẩm đã đặt mà nay không cần nữa vẫn hiện để báo NCC bớt
  Object.values(sentOrder).forEach((foods) =>
    Object.keys(foods).forEach((foodId) => {
      const f = foodById[foodId];
      if (f && !buy[foodId]) buy[foodId] = { foodId, name: f.name, unit: f.purchaseUnit || f.unit, storage: storageOf(f), byDate: {} };
    }),
  );
  const byName = (a, b) => a.name.localeCompare(b.name, 'vi');
  const fresh = Object.values(buy)
    .filter((f) => f.storage !== 'DRY')
    .sort(byName)
    .map((f) => {
      const cellsOf = days.map((d) => ({ date: d.date, qty: f.byDate[d.date] || 0, sentQty: sentOrder[d.date]?.[f.foodId] ?? null }));
      return { foodId: f.foodId, name: f.name, unit: f.unit, days: cellsOf, total: r3(cellsOf.reduce((n, x) => n + x.qty, 0)) };
    })
    .filter((f) => f.total > 0 || f.days.some((x) => x.sentQty));
  // Đồ khô: chỉ các ngày chưa chốt (ngày đã chốt đã xuất kho), trừ tồn hiện có
  const dry = Object.values(buy)
    .filter((f) => f.storage === 'DRY')
    .sort(byName)
    .map((f) => {
      const need = r3(days.filter((d) => !d.confirmed).reduce((n, d) => n + (f.byDate[d.date] || 0), 0));
      const stock = r3(ctx.stockOf(f.foodId));
      const toBuy = need > stock ? roundUp(need - stock, purchaseStep(f.unit)) : 0;
      return { foodId: f.foodId, name: f.name, unit: f.unit, need, stock, toBuy };
    })
    .filter((f) => f.need > 0);

  const changes = record?.sentAt ? changesOf(days, fresh, record) : [];
  return {
    campusId,
    weekStart,
    status: days.some((d) => d.hasMenu) ? 'READY' : 'NO_MENU',
    days: outDays,
    classes: outClasses,
    fresh,
    dry,
    changes,
    pendingChanges: changes.reduce((n, g) => n + g.lines.filter((l) => !l.notified).length, 0),
  };
}

/**
 * Dòng cần báo NCC: số cần hiện tại khác số NCC đã biết (bản gửi hoặc lần báo gần nhất).
 * Dòng đã báo giữ lại (có dấu) tới khi số cần đổi tiếp.
 */
function changesOf(days, fresh, record) {
  const notices = record.notices || [];
  return days
    .filter((d) => !d.holiday && record.sentOrder?.[d.date])
    .map((d) => {
      const lines = fresh
        .map((f) => {
          const sent = record.sentOrder[d.date]?.[f.foodId] || 0;
          const needed = f.days.find((x) => x.date === d.date)?.qty || 0;
          const told = notices.filter((n) => n.date === d.date && n.foodId === f.foodId);
          const last = told.at(-1);
          const known = last ? last.needed : sent;
          const pending = needed !== known;
          if (!pending && needed === sent) return null;
          const ordered = pending ? known : told.length > 1 ? told.at(-2).needed : sent;
          return {
            foodId: f.foodId,
            name: f.name,
            unit: f.unit,
            ordered,
            needed,
            diff: r3(needed - ordered),
            notified: !pending,
            notifiedAt: pending ? null : last.at,
          };
        })
        .filter(Boolean);
      return {
        date: d.date,
        kind: d.confirmed ? 'AFTER_CONFIRM' : 'FORECAST_CHANGED',
        sentTotal: record.sentTotals?.[d.date] ?? null,
        lines,
      };
    })
    .filter((g) => g.lines.length);
}

/**
 * Số NCC đang giao cho một ngày: lần báo NCC gần nhất, không có thì bản gửi, chưa gửi thì số dự trù hiện tại.
 * Dùng làm cột "Đặt" khi bếp kiểm nhận hàng tươi theo phiếu giao hàng (S5).
 */
export const knownOrderOf = (view, record, date) =>
  view.fresh
    .map((f) => {
      const notices = (record?.notices || []).filter((n) => n.date === date && n.foodId === f.foodId);
      const sent = record?.sentOrder?.[date]?.[f.foodId];
      const current = f.days.find((x) => x.date === date)?.qty || 0;
      const ordered = notices.length ? notices.at(-1).needed : record?.sentAt ? sent || 0 : current;
      return { foodId: f.foodId, name: f.name, unit: f.unit, ordered };
    })
    .filter((f) => f.ordered > 0);

/** Bản gửi NCC: lượng tươi từng ngày và tổng suất từng ngày tại lúc gửi. */
export const sentSnapshot = (view) => ({
  sentOrder: Object.fromEntries(
    view.days
      .filter((d) => !d.holiday)
      .map((d) => [d.date, Object.fromEntries(view.fresh.map((f) => [f.foodId, f.days.find((x) => x.date === d.date)?.qty || 0]))]),
  ),
  sentTotals: Object.fromEntries(view.days.filter((d) => !d.holiday).map((d) => [d.date, d.total])),
});
