import { USE_MOCK } from '@/config/env';
import { pickupMockRepository } from '@/services/pickup/mock/pickupMockRepository';
import { pickupApi } from '@/services/pickup/api/pickupApi';

/** Facade: UI only calls these functions. `user` is used by the mock; the API reads it from the token. */
const repo = USE_MOCK ? pickupMockRepository : pickupApi;

export const getPickupBoard = (query, user) => repo.getPickupBoard(query, user);
export const getPickupChild = (childId, user) => repo.getPickupChild(childId, user);
export const recordPickupResult = (form, user) => repo.recordPickupResult(form, user);
export const getPickupResults = (query, user) => repo.getPickupResults(query, user);
