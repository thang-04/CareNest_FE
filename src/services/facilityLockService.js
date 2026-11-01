import { isDemoModule } from '@/services/demoSource';
import { axiosClient } from '@/services/http/axiosClient';
import { readDb, delay } from '@/mocks/mockDatabase';
import { lockedLocationMap } from '@/mocks/inventoryLock';

/**
 * Locations whose asset data is locked by a running inventory round: { locationId: roundCode }.
 * Shared rule: while locked, no module may move or change those assets.
 */
export const getLockedLocations = async () => {
  if (!isDemoModule('inventory-inspection')) return axiosClient.get('/inspections/locked-locations');
  await delay(60);
  return lockedLocationMap(readDb());
};
