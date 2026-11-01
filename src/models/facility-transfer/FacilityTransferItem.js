/**
 * One asset line on a transfer.
 * @typedef {Object} FacilityTransferItem
 * @property {string} id
 * @property {string} assetId             stock line at the sending location
 * @property {string} assetCode
 * @property {string} assetName
 * @property {string} unit
 * @property {string} categoryId
 * @property {string|null} imageUrl
 * @property {number} quantity            quantity on the document (theo phiếu)
 * @property {string} condition           condition when the document was created
 * @property {number|null} handoverQuantity
 * @property {string|null} handoverCondition
 * @property {string} handoverNote
 * @property {string[]} handoverImages
 * @property {number|null} receivedQuantity
 * @property {string|null} receivedCondition
 * @property {string} receivedNote
 * @property {string[]} receivedImages
 * @property {number|null} acceptedQuantity   set when the VP accepts the received quantity
 * @property {number} cancelledQuantity        defective part removed by the VP
 * @property {number|null} supplementRequired  quantity the handover person still has to deliver
 * @property {Array} supplementHistory         [{ quantity, note, images, by, at }]
 */

export const createTransferItem = (asset, quantity = 1) => ({
  id: `item_${asset.id}`,
  assetId: asset.id,
  assetCode: asset.code,
  assetName: asset.name,
  unit: asset.unit,
  categoryId: asset.categoryId,
  imageUrl: asset.imageUrl || null,
  quantity,
  condition: asset.condition,
  handoverQuantity: null,
  handoverCondition: null,
  handoverNote: '',
  handoverImages: [],
  receivedQuantity: null,
  receivedCondition: null,
  receivedNote: '',
  receivedImages: [],
  acceptedQuantity: null,
  cancelledQuantity: 0,
  supplementRequired: null,
  supplementHistory: [],
});

/** Quantity the receiver is expected to receive after all VP decisions. */
export const expectedReceiveQuantity = (item) => {
  if (item.acceptedQuantity != null) return item.acceptedQuantity;
  const handed = item.handoverQuantity ?? item.quantity;
  return Math.max(0, handed - (item.cancelledQuantity || 0));
};

export const isBadCondition = (condition) => ['NEED_REPAIR', 'BROKEN'].includes(condition);

/**
 * Problem parts of a discrepancy line: missing units, extra units, damaged units (not accepted).
 * Older lines without `damagedQuantity` count every unit as damaged when the condition was bad.
 */
export const discrepancyParts = (line) => {
  const expected = line.expectedQuantity ?? line.handoverQuantity ?? line.documentQuantity;
  const received = line.receivedQuantity ?? 0;
  const damaged = line.damagedQuantity ?? (isBadCondition(line.condition) ? received : 0);
  return {
    shortage: Math.max(0, expected - received),
    surplus: Math.max(0, received - expected),
    damaged,
    good: Math.max(0, received - damaged),
  };
};
