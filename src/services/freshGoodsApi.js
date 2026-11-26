import { MEAL_SESSION_LABELS } from '@/models/mealSessions';
import { toReceipt } from '@/services/dryStockApi';
import { beClient } from '@/services/http/beClient';
import { toBaseQuantity, toPurchaseQuantity } from '@/utils/kitchen/stockUnits';

/*
 * Hàng tươi trên BE: bản dự trù `/nutrition/fresh-forecasts` (xem trước rồi lưu), kiểm nhận hai lần trong ngày
 * `/nutrition/fresh-checks` và bảng đi chợ theo ngày `/nutrition/day-market`. BE lưu và trả số lượng theo đơn vị gốc của thực phẩm (g/ml); adapter thêm bản theo đơn vị mua
 * (`purchase*`) để màn hình hiện, và đổi số nhập (đơn vị mua) về đơn vị gốc khi gửi. Số lượng, kết quả, lần kiểm nào mở
 * được do BE quyết định; FE chỉ gửi các ô người dùng nhập.
 */
const blank = (v) => v === '' || v == null;
const text = (v) => (blank(v) ? '' : String(v).trim());
const params = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !blank(v)));
const fieldError = (message, details) => Object.assign(new Error(message), { details });

const toForecastLine = (line) => ({
  ...line,
  purchaseTotal: toPurchaseQuantity(line.totalQty, line.food),
  byDate: (line.byDate || []).map((cell) => ({ ...cell, purchaseQuantity: toPurchaseQuantity(cell.quantity, line.food) })),
});
// Hàng khô cần nhập thêm (NUT-11): BE tính lại mỗi lần xem theo tồn hiện tại; FE chỉ đổi sang đơn vị mua
const toDryLine = (line) => ({
  ...line,
  purchaseRequiredQty: toPurchaseQuantity(line.requiredQty, line.food),
  purchaseAvailableQty: toPurchaseQuantity(line.availableQty, line.food),
  purchaseShortQty: toPurchaseQuantity(line.shortQty, line.food),
});
// Lượng hàng khô đặt cho kỳ (NUT-12): xem trước là gợi ý, đã lưu là số chụp dùng để in và kiểm nhận
const toDryOrderLine = (line) => ({ ...line, purchaseQuantity: toPurchaseQuantity(line.quantity, line.food) });
// BE luôn trả đủ các mảng; chuẩn hóa để màn không phải kiểm null từng chỗ
const toForecast = (forecast) => ({
  ...forecast,
  counts: forecast?.counts || [],
  days: forecast?.days || [],
  lines: (forecast?.lines || []).map(toForecastLine),
  dryLines: (forecast?.dryLines || []).map(toDryLine),
  dryOrder: (forecast?.dryOrder || []).map(toDryOrderLine),
});

const toCheckLine = (line) => ({
  ...line,
  purchaseExpectedQty: toPurchaseQuantity(line.expectedQty, line.food),
  purchaseReceivedQty: line.receivedQty == null ? null : toPurchaseQuantity(line.receivedQty, line.food),
});
// Hàng khô giao trong ngày: đã đặt (null = ngoài đơn) và đã nhận cộng dồn của kỳ, BE tính
const toDryOrderStatus = (line) => ({
  ...line,
  purchaseOrdered: line.ordered == null ? null : toPurchaseQuantity(line.ordered, line.food),
  purchaseReceived: toPurchaseQuantity(line.received, line.food),
});
const toCheck = (check) => ({
  ...check,
  rounds: (check?.rounds || []).map((round) => ({ ...round, lines: (round.lines || []).map(toCheckLine) })),
  dry: {
    forecastId: check?.dry?.forecastId ?? null,
    periodFrom: check?.dry?.periodFrom ?? null,
    periodTo: check?.dry?.periodTo ?? null,
    orders: (check?.dry?.orders || []).map(toDryOrderStatus),
    receipts: (check?.dry?.receipts || []).map(toReceipt),
  },
});

const DAY_MARKET_STATUS = { DAY_OFF: 'HOLIDAY' };
const DAY_MARKET_SOURCE = { DRY: 'STOCK', FRESH: 'MARKET' };

/*
 * Bảng đi chợ BE -> dạng màn Đi chợ theo ngày. Lượng và tiền do BE tính; ở đây chỉ đổi lượng từ đơn vị gốc sang đơn vị
 * mua và đổi tên field. Dòng thực phẩm hiện lượng cần mua/xuất (`orderQuantity`), cột nhóm tuổi hiện lượng thực dùng.
 */
export const toDayMarket = (market) => {
  const groups = (market?.groups || []).map((g) => ({
    ageGroupId: g.ageGroupId,
    name: g.name,
    servings: g.servings,
    price: g.mealPrice,
    serviceFee: g.serviceFee ?? 0,
    revenue: g.revenue,
    foodBudget: g.foodBudget ?? null,
  }));
  const totals = market?.totals || {};
  return {
    campusId: market?.campusId,
    date: market?.date,
    status: DAY_MARKET_STATUS[market?.status] || market?.status,
    basis: market?.basis,
    ...(market?.balanceRound ? { balanceRound: market.balanceRound } : {}),
    confirmedAt: market?.confirmedAt,
    groups,
    lines: (market?.lines || []).map((line) => ({
      foodId: line.food.id,
      name: line.food.name,
      // NCC của thực phẩm tại ngày đi chợ theo mức giá hiệu lực (NUT-27); id để gom nhóm và in theo NCC
      supplierId: line.supplierId ?? null,
      supplierName: line.supplierName || '',
      contractStatus: line.contractStatus || null,
      unit: line.food.purchaseUnit,
      unitPrice: line.unitPrice,
      source: DAY_MARKET_SOURCE[line.storage],
      quantity: toPurchaseQuantity(line.orderQuantity, line.food),
      amount: line.cost,
      groups: (line.groups || []).map((g) => ({
        ageGroupId: g.ageGroupId,
        quantity: toPurchaseQuantity(g.quantity, line.food),
        amount: g.cost,
      })),
    })),
    totals: {
      servings: totals.servings ?? 0,
      revenue: totals.revenue ?? null,
      // Ngân sách thực phẩm = tổng thu − phí dịch vụ (NUT-19); phần thừa thiếu so với khoản này
      foodBudget: totals.foodBudget ?? null,
      cost: totals.cost ?? 0,
      marketCost: totals.freshCost ?? 0,
      stockCost: totals.dryCost ?? 0,
      balance: totals.balance ?? null,
      groups: totals.groups || [],
    },
    menu: (market?.menu || []).map((meal) => ({
      code: meal.session,
      name: MEAL_SESSION_LABELS[meal.session] || meal.session,
      groups: meal.groups || [],
    })),
    warnings: groups
      .filter((g) => g.price == null)
      .map((g) => `${g.name} chưa có giá tiền ăn nên chưa tính được tiền thu và phần thừa thiếu.`),
  };
};

/**
 * Form bản dự trù -> body BE. `counts` rỗng (null) = để BE điền sẵn số trẻ đang theo học; có `counts` = số trẻ dự kiến
 * người dùng đã sửa. Số trẻ không phải số nguyên không âm bị chặn ở đây thay vì gửi sai.
 */
export const toForecastRequest = (form) => {
  const body = { campusId: form.campusId, periodFrom: form.periodFrom, periodTo: form.periodTo, note: text(form.note) };
  if (form.counts) {
    body.counts = form.counts.map((count, i) => {
      const expectedCount = Number(count.expectedCount);
      if (blank(count.expectedCount) || !Number.isInteger(expectedCount) || expectedCount < 0)
        throw fieldError('Số trẻ dự kiến phải là số nguyên từ 0', { [`counts.${i}`]: 'Nhập số trẻ dự kiến (số nguyên từ 0)' });
      return { ageGroupId: count.ageGroupId, expectedCount };
    });
  }
  // dryOrder null = để BE lấy gợi ý phần thiếu tới hết kỳ; có mảng = lượng PHT đã sửa (nhập theo đơn vị mua)
  if (form.dryOrder) {
    body.dryOrder = form.dryOrder.map((line, i) => {
      const qty = Number(line.purchaseQuantity);
      if (blank(line.purchaseQuantity) || !Number.isFinite(qty) || qty < 0)
        throw fieldError('Lượng hàng khô đặt phải là số từ 0', { [`dryOrder.${i}`]: 'Nhập lượng đặt (số từ 0)' });
      return { foodId: line.food.id, quantity: toBaseQuantity(qty, line.food) };
    });
  }
  return body;
};

/**
 * Form một đợt hàng khô (lượng theo đơn vị mua) -> body BE. `foodById` tra đơn vị mua; dòng không đạt cần ghi biện pháp
 * xử lý là hỗ trợ nhập liệu, BE vẫn kiểm lại.
 */
export const toDryIntakeRequest = (form, foodById) => ({
  supplierId: form.supplierId,
  note: text(form.note),
  lines: (form.lines || []).map((line, i) => {
    const food = foodById[String(line.foodId)];
    if (!food) throw fieldError('Chọn thực phẩm kho khô', { [`lines.${i}.foodId`]: 'Chọn thực phẩm' });
    return {
      foodId: line.foodId,
      lotNo: text(line.lotNo),
      expiryDate: line.expiryDate,
      quantity: toBaseQuantity(line.purchaseQty, food),
      unitPrice: blank(line.unitPrice) ? null : Number(line.unitPrice),
      passed: line.passed,
      note: text(line.note),
    };
  }),
});

/**
 * Form một lần kiểm (số thực nhận theo đơn vị mua) -> body BE. `lines` là dòng cần nhận của lần đó, dùng để tra đơn vị mua
 * của từng thực phẩm; số thực nhận để trống thì gửi null (BE cho phép bỏ trống).
 */
export const toCheckRequest = (form, lines) => {
  const foodById = Object.fromEntries((lines || []).map((line) => [String(line.food?.id), line.food]));
  return {
    note: text(form.note),
    lines: (form.lines || []).map((line, i) => {
      const food = foodById[String(line.foodId)];
      if (!food) throw fieldError('Thực phẩm không còn trong lần kiểm này', { [`lines.${i}.foodId`]: 'Tải lại trang rồi kiểm lại' });
      return {
        foodId: line.foodId,
        receivedQty: blank(line.receivedQty) ? null : toBaseQuantity(line.receivedQty, food),
        result: line.result,
        note: text(line.note),
        supplierId: blank(line.supplierId) ? null : Number(line.supplierId),
      };
    }),
  };
};

/** Factory để test thay client HTTP. */
export const createFreshGoodsApi = ({ client = beClient } = {}) => ({
  /**
   * Các bản dự trù đã lưu của điểm trường, mới nhất trước: [{ id, periodFrom, periodTo, note, foodCount, createdAt, version, current }];
   * `current` = bản đang dùng cho kiểm nhận, `version` = thứ tự lập trong cùng kỳ.
   */
  async listForecasts({ campusId } = {}) {
    return (await client.get('/nutrition/fresh-forecasts', { params: params({ campusId }) })) || [];
  },

  async getForecast(id) {
    return toForecast(await client.get(`/nutrition/fresh-forecasts/${id}`));
  },

  /** Tính dự trù theo kỳ và số trẻ dự kiến nhưng chưa lưu (`id` = null). */
  async previewForecast(form) {
    return toForecast(await client.post('/nutrition/fresh-forecasts/preview', toForecastRequest(form)));
  },

  async saveForecast(form) {
    return toForecast(await client.post('/nutrition/fresh-forecasts', toForecastRequest(form)));
  },

  async deleteForecast(id) {
    await client.delete(`/nutrition/fresh-forecasts/${id}`);
    return { id };
  },

  /** Bảng đi chợ của điểm trường trong một ngày: thực phẩm, tiền theo nhóm tuổi, thu–chi, thực đơn. */
  async getDayMarket({ campusId, date } = {}) {
    return toDayMarket(await client.get('/nutrition/day-market', { params: params({ campusId, date }) }));
  },

  /** Hai lần kiểm nhận của điểm trường trong ngày. */
  async getCheck({ campusId, date } = {}) {
    return toCheck(await client.get('/nutrition/fresh-checks', { params: params({ campusId, date }) }));
  },

  /** Ghi nhận một lần kiểm (`round` 1 hoặc 2); BE trả cả hai lần vì lần 1 có thể mở lần 2. */
  async saveCheckRound({ campusId, date, round, form, lines }) {
    return toCheck(await client.put('/nutrition/fresh-checks', toCheckRequest(form, lines), { params: { campusId, date, round } }));
  },

  /** Ghi một đợt hàng khô giao hôm nay: BE lập phiếu nhập đã xác nhận từ dòng đạt, trả lại cả ngày kiểm nhận. */
  async saveDryIntake({ campusId, date, form, foodById }) {
    return toCheck(
      await client.post('/nutrition/fresh-checks/dry-receipts', toDryIntakeRequest(form, foodById), { params: { campusId, date } }),
    );
  },
});

export const freshGoodsApi = createFreshGoodsApi();
