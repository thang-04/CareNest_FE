/*
 * Kiểm nhận lần 2 theo cân đối: so lượng cần với hàng đã nhận lần 1, PHT chọn gọi thêm, trả lại hoặc giữ dùng. Số lượng
 * theo đơn vị mua; BE kiểm lại và tính số thực nhận, đủ / thiếu / thừa.
 */
export const HANDLING_LABELS = { ORDER_MORE: 'Gọi thêm', RETURN: 'Trả lại', KEEP: 'Giữ dùng' };
const NEEDS_QUANTITY = new Set(['ORDER_MORE', 'RETURN']);

const round3 = (n) => Math.round(n * 1000) / 1000;
const idOf = (v) => (v == null ? '' : String(v));

/** Hàng đã nhận lần 1 trừ lượng cần: dương là thừa, âm là thiếu. */
export const differenceOf = (line) => round3(Number(line.purchaseRound1Qty || 0) - Number(line.purchaseExpectedQty || 0));

/** Ô nhập từ BE: lần đã ghi giữ lựa chọn cũ; chưa ghi thì gợi ý trả phần thừa, gọi thêm phần thiếu. */
export const handlingToForm = (round) => ({
  note: round.note || '',
  lines: round.lines.map((line) => {
    const difference = differenceOf(line);
    const suggested = difference > 0 ? 'RETURN' : difference < 0 ? 'ORDER_MORE' : '';
    const action = round.recorded ? line.handlingAction || '' : suggested;
    const quantity = round.recorded ? line.purchaseHandlingQty : Math.abs(difference);
    return {
      foodId: idOf(line.food.id),
      handlingAction: action,
      handlingQty: NEEDS_QUANTITY.has(action) && quantity != null ? String(quantity) : '',
      note: line.note || '',
      supplierId: idOf(line.supplier?.id),
    };
  }),
});

export const validateHandlingForm = (form, lines) => {
  const errors = {};
  form.lines.forEach((row, i) => {
    const line = lines[i];
    if (!row.handlingAction) {
      if (differenceOf(line) !== 0) errors[`lines.${i}.handlingAction`] = 'Chọn cách xử lý';
      return;
    }
    if (!NEEDS_QUANTITY.has(row.handlingAction)) return;
    const quantity = Number(row.handlingQty);
    if (row.handlingQty === '' || !Number.isFinite(quantity) || quantity <= 0) errors[`lines.${i}.handlingQty`] = 'Nhập số lượng lớn hơn 0';
    else if (row.handlingAction === 'RETURN' && quantity > Number(line.purchaseRound1Qty || 0))
      errors[`lines.${i}.handlingQty`] = 'Không trả quá số đã nhận lần 1';
  });
  return errors;
};

/** Dòng phiếu chênh lệch gửi nhà cung cấp: chỉ dòng gọi thêm hoặc trả lại. */
export const handlingSlipRows = (form, lines) =>
  form.lines.flatMap((row, i) =>
    NEEDS_QUANTITY.has(row.handlingAction)
      ? [
          {
            food: lines[i].food,
            action: row.handlingAction,
            quantity: Number(row.handlingQty),
            supplier: lines[i].supplier?.name || '',
            note: row.note,
          },
        ]
      : [],
  );
