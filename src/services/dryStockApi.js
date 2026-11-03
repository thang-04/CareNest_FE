import { beClient } from '@/services/http/beClient';
import { toBaseQuantity, toPurchaseQuantity } from '@/utils/kitchen/stockUnits';

/*
 * Kho khô trên BE `/nutrition/stock/*`: phiếu nhập, tồn theo lô, lịch sử nhập/trừ, phần thiếu chờ bổ sung. BE lưu và trả số
 * lượng theo đơn vị gốc của thực phẩm (g/ml); adapter thêm bản theo đơn vị mua (`purchase*`) để màn hình hiện, và đổi số
 * nhập (đơn vị mua) về đơn vị gốc khi gửi. Đơn giá luôn trên một đơn vị mua. Trạng thái, tổng tiền, cờ `canManage` do BE trả.
 */
const blank = (v) => v === '' || v == null;
const text = (v) => (blank(v) ? '' : String(v).trim());
const params = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !blank(v)));

const toLine = (line) => ({ ...line, purchaseQuantity: toPurchaseQuantity(line.quantity, line.food) });
const toReceipt = (receipt) => ({ ...receipt, lines: (receipt.lines || []).map(toLine) });
const toLot = (lot) => ({
  ...lot,
  purchaseQuantity: toPurchaseQuantity(lot.quantity, lot.food),
  purchaseRemaining: toPurchaseQuantity(lot.remaining, lot.food),
});
const toMovement = (movement) => ({ ...movement, purchaseQuantity: toPurchaseQuantity(movement.quantity, movement.food) });
const toShortfall = (row) => ({
  ...row,
  purchaseRequiredQty: toPurchaseQuantity(row.requiredQty, row.food),
  purchaseShortfallQty: toPurchaseQuantity(row.shortfallQty, row.food),
});

/**
 * Form phiếu (số lượng theo đơn vị mua) -> body BE. `foodById` tra `purchaseUnitSize` của thực phẩm từng dòng.
 * Dòng chọn thực phẩm không có trong `foodById` thì báo lỗi theo ô thay vì gửi sai đơn vị.
 */
export const toReceiptRequest = (form, foodById) => ({
  campusId: form.campusId,
  supplierId: form.supplierId,
  receivedDate: form.receivedDate,
  note: text(form.note),
  lines: (form.lines || []).map((line, i) => {
    const food = foodById[String(line.foodId)];
    if (!food)
      throw Object.assign(new Error('Thực phẩm không còn trong danh mục'), { details: { [`lines[${i}].foodId`]: 'Chọn lại thực phẩm' } });
    return {
      foodId: line.foodId,
      lotNo: text(line.lotNo),
      expiryDate: line.expiryDate,
      quantity: toBaseQuantity(line.purchaseQty, food),
      unitPrice: blank(line.unitPrice) ? null : Number(line.unitPrice),
    };
  }),
});

/** Factory để test thay client HTTP. */
export const createDryStockApi = ({ client = beClient } = {}) => ({
  async listReceipts({ campusId, from, to, status } = {}) {
    const rows = await client.get('/nutrition/stock/receipts', { params: params({ campusId, from, to, status }) });
    return (rows || []).map(toReceipt);
  },

  async getReceipt(id) {
    return toReceipt(await client.get(`/nutrition/stock/receipts/${id}`));
  },

  /** `id` rỗng ⇒ tạo phiếu nháp; có `id` ⇒ sửa phiếu nháp. */
  async saveReceipt(id, form, foodById) {
    const body = toReceiptRequest(form, foodById);
    const saved = id ? await client.put(`/nutrition/stock/receipts/${id}`, body) : await client.post('/nutrition/stock/receipts', body);
    return toReceipt(saved);
  },

  async deleteReceipt(id) {
    await client.delete(`/nutrition/stock/receipts/${id}`);
    return { id };
  },

  async confirmReceipt(id) {
    return toReceipt(await client.post(`/nutrition/stock/receipts/${id}/confirm`));
  },

  async cancelReceipt(id, reason) {
    return toReceipt(await client.post(`/nutrition/stock/receipts/${id}/cancel`, { reason: text(reason) }));
  },

  async listLots({ campusId, foodId, includeEmpty = false } = {}) {
    const rows = await client.get('/nutrition/stock/lots', { params: params({ campusId, foodId, includeEmpty: !!includeEmpty }) });
    return (rows || []).map(toLot);
  },

  /** Phân trang theo BE (page từ 0): { items, page, size, totalElements, totalPages }. */
  async listMovements({ campusId, from, to, foodId, type, page = 0, size = 50 } = {}) {
    const result = await client.get('/nutrition/stock/movements', { params: params({ campusId, from, to, foodId, type, page, size }) });
    return { ...result, items: (result?.items || []).map(toMovement) };
  },

  async listShortfalls({ campusId } = {}) {
    const rows = await client.get('/nutrition/stock/shortfalls', { params: params({ campusId }) });
    return (rows || []).map(toShortfall);
  },
});

export const dryStockApi = createDryStockApi();
