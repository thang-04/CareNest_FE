import { beClient } from '@/services/http/beClient';
import { toBaseQuantity, toPurchaseQuantity } from '@/utils/kitchen/stockUnits';

/*
 * Hàng tươi trên BE: bản dự trù `/nutrition/fresh-forecasts` (xem trước rồi lưu) và kiểm nhận hai lần trong ngày
 * `/nutrition/fresh-checks`. BE lưu và trả số lượng theo đơn vị gốc của thực phẩm (g/ml); adapter thêm bản theo đơn vị mua
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
// BE luôn trả đủ các mảng; chuẩn hóa để màn không phải kiểm null từng chỗ
const toForecast = (forecast) => ({
  ...forecast,
  counts: forecast?.counts || [],
  days: forecast?.days || [],
  lines: (forecast?.lines || []).map(toForecastLine),
});

const toCheckLine = (line) => ({
  ...line,
  purchaseExpectedQty: toPurchaseQuantity(line.expectedQty, line.food),
  purchaseReceivedQty: line.receivedQty == null ? null : toPurchaseQuantity(line.receivedQty, line.food),
});
const toCheck = (check) => ({
  ...check,
  rounds: (check?.rounds || []).map((round) => ({ ...round, lines: (round.lines || []).map(toCheckLine) })),
});

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
  return body;
};

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
      };
    }),
  };
};

/** Factory để test thay client HTTP. */
export const createFreshGoodsApi = ({ client = beClient } = {}) => ({
  /** Các bản dự trù đã lưu của điểm trường, mới nhất trước: [{ id, periodFrom, periodTo, note, foodCount, createdAt }]. */
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

  /** Hai lần kiểm nhận của điểm trường trong ngày. */
  async getCheck({ campusId, date } = {}) {
    return toCheck(await client.get('/nutrition/fresh-checks', { params: params({ campusId, date }) }));
  },

  /** Ghi nhận một lần kiểm (`round` 1 hoặc 2); BE trả cả hai lần vì lần 1 có thể mở lần 2. */
  async saveCheckRound({ campusId, date, round, form, lines }) {
    return toCheck(await client.put('/nutrition/fresh-checks', toCheckRequest(form, lines), { params: { campusId, date, round } }));
  },
});

export const freshGoodsApi = createFreshGoodsApi();
