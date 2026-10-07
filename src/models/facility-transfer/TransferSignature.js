/**
 * Signature captured on one transfer document.
 * @typedef {Object} TransferSignature
 * @property {string} id
 * @property {'CREATOR'|'HANDOVER'|'RECEIVER'} type
 * @property {string} signedBy        user id
 * @property {string} signedByName
 * @property {string} signatureUrl
 * @property {string} signedAt
 * @property {number} documentVersion  transfer.version when signed
 * @property {boolean} valid
 * @property {string|null} invalidatedAt
 * @property {string|null} invalidReason
 */

/** Latest valid signature of a type. */
export const getValidSignature = (transfer, type) =>
  (transfer?.signatures || []).filter((s) => s.type === type && s.valid).slice(-1)[0] || null;
