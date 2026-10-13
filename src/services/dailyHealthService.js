import { USE_MOCK } from '@/config/env';
import { dailyHealthMockRepository } from '@/mocks/dailyHealthMockRepository';
import { dailyHealthApi } from '@/services/daily-health/api/dailyHealthApi';

/** Facade: UI only calls these functions. `user` is used by the mock; the API reads it from the token. */
const repo = USE_MOCK ? dailyHealthMockRepository : dailyHealthApi;

export const getDailyHealth = async (query, user) => repo.getDailyHealth(query, user);
export const addDailyHealth = async (payload, user) => repo.addDailyHealth(payload, user);
export const notifyDailyHealth = async (entryId, user) => repo.notifyDailyHealth(entryId, user);
export const getDailyHealthOverview = async (query, user) => repo.getDailyHealthOverview(query, user);
export const getChildDailyHealthHistory = async (query, user) => repo.getChildDailyHealthHistory(query, user);
