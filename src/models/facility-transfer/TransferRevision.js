/**
 * Snapshot of the document each time it is (re)submitted. Never deleted.
 * @typedef {Object} TransferRevision
 * @property {string} id
 * @property {number} version
 * @property {string} createdAt
 * @property {string} createdBy
 * @property {string} changeNote
 * @property {Object} snapshot   general info + items at that version
 * @property {string|null} revisionRequestId
 */

/**
 * Request from the handover person to correct the document before signing.
 * @typedef {Object} TransferRevisionRequest
 * @property {string} id
 * @property {string} requestedBy
 * @property {string} requestedAt
 * @property {string} reason
 * @property {number} version        document version the request refers to
 * @property {string|null} resolvedAt
 * @property {number|null} resolvedVersion
 */
export {};
