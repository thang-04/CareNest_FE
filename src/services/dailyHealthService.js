import { SCHOOL_CONFIG_API, USE_MOCK } from '@/config/env';
import { beClient } from '@/services/http/beClient';
import { dailyHealthMockRepository } from '@/mocks/dailyHealthMockRepository';
import { createDailyHealthBeApi, dailyHealthApi } from '@/services/daily-health/api/dailyHealthApi';

/** Facade: UI only calls these functions. `user` is used by the mock; the API reads it from the token. */
// Dev: cầu nối BE thật (VITE_SCHOOL_CONFIG_API) như điểm danh đợt 1
const repo = SCHOOL_CONFIG_API ? createDailyHealthBeApi(beClient) : USE_MOCK ? dailyHealthMockRepository : dailyHealthApi;

export const getDailyHealth = async (query, user) => repo.getDailyHealth(query, user);
export const addDailyHealth = async (payload, user) => repo.addDailyHealth(payload, user);
// BE thật chưa gửi thông báo phụ huynh ⇒ UI không hứa "đã gửi thông báo"
export const PARENT_NOTIFY_ENABLED = !SCHOOL_CONFIG_API;
export const notifyDailyHealth = async (entryId, user) => repo.notifyDailyHealth(entryId, user);
export const getDailyHealthOverview = async (query, user) => repo.getDailyHealthOverview(query, user);
export const getChildDailyHealthHistory = async (query, user) => repo.getChildDailyHealthHistory(query, user);
