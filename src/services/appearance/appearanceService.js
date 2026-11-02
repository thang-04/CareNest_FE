import { sourceOf } from '@/services/demoSource';
import { appearanceMockRepository } from '@/services/appearance/mock/appearanceMockRepository';
import { appearanceApi } from '@/services/appearance/api/appearanceApi';

/** Facade cấu hình tranh nền giao diện của trường: UI chỉ gọi các hàm này. */
const repo = sourceOf('appearance', appearanceMockRepository, appearanceApi);

export const getAppearance = (user) => repo.getAppearance(user);
export const saveAppearance = (form, user) => repo.saveAppearance(form, user);
