import { USE_MOCK } from '@/config/env';
import { dailyHealthMockRepository } from '@/mocks/dailyHealthMockRepository';

const repository = () => {
  if (!USE_MOCK) {
    const error = new Error('Ghi nhận sức khỏe trong ngày chưa được kết nối backend.');
    error.status = 503;
    throw error;
  }
  return dailyHealthMockRepository;
};

export const getDailyHealth = async (query, user) => repository().getDailyHealth(query, user);
export const addDailyHealth = async (payload, user) => repository().addDailyHealth(payload, user);
export const notifyDailyHealth = async (entryId, user) => repository().notifyDailyHealth(entryId, user);
