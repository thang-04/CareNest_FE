/**
 * Discrepancy reported by the receiver after the handover was signed.
 * @typedef {Object} TransferDiscrepancy
 * @property {string} id
 * @property {string} reportedBy
 * @property {string} reportedAt
 * @property {string} description
 * @property {DiscrepancyLine[]} lines
 * @property {'OPEN'|'RESOLVED'} status
 * @property {Object|null} resolution  { note, resolvedBy, resolvedAt, decisions: [{itemId, action, newQuantity, cancelQuantity}] }
 */

/**
 * @typedef {Object} DiscrepancyLine
 * @property {string} itemId
 * @property {number} documentQuantity
 * @property {number} handoverQuantity
 * @property {number} receivedQuantity
 * @property {number} difference
 * @property {string} condition
 * @property {string} note
 * @property {string[]} images
 */
export {};
