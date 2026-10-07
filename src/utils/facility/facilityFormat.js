const money = new Intl.NumberFormat('vi-VN');

/** Estimated cost in VND, or a dash when not estimated. */
export const formatMoney = (value) => (value === null || value === undefined || value === '' ? '—' : `${money.format(Number(value))} đ`);

/** Total estimated cost of a proposal (each line holds the estimate of the whole line). */
export const proposalTotal = (lines = []) =>
  lines.reduce(
    (sum, l) =>
      sum + (l.estimatedCost === '' || l.estimatedCost === null || l.estimatedCost === undefined ? 0 : Number(l.estimatedCost) || 0),
    0,
  );
