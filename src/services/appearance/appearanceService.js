import { USE_MOCK } from '@/config/env';
import { appearanceMockRepository } from '@/services/appearance/mock/appearanceMockRepository';
import { appearanceApi } from '@/services/appearance/api/appearanceApi';

/** Facade cấu hình tranh nền giao diện của trường: UI chỉ gọi các hàm này. */
const repo = USE_MOCK ? appearanceMockRepository : appearanceApi;

export const getAppearance = (user) => repo.getAppearance(user);
export const saveAppearance = (form, user) => repo.saveAppearance(form, user);
