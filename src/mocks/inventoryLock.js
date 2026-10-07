/**
 * Server-side rule shared by the transfer and inventory repositories:
 * while an inventory round is running, its locations' asset data is locked.
 */
const LOCKING = ['IN_PROGRESS', 'PENDING_APPROVAL'];

/** Returns { round, locationId } of the first lock found, or null. */
export const findInventoryLock = (db, locationIds) => {
  for (const round of db.inspections || []) {
    if (!LOCKING.includes(round.status)) continue;
    const sheet = (round.sheets || []).find((s) => locationIds.includes(s.locationId) && s.status !== 'CANCELLED');
    if (sheet) return { round, locationId: sheet.locationId };
  }
  return null;
};

export const lockedLocationMap = (db) => {
  const map = {};
  (db.inspections || []).forEach((round) => {
    if (!LOCKING.includes(round.status)) return;
    (round.sheets || []).forEach((s) => {
      map[s.locationId] = round.code;
    });
  });
  return map;
};
