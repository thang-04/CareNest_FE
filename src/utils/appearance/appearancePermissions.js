import { ROLES } from '@/models/User';

/** Đổi tranh nền chung của trường: Hiệu trưởng, Phó hiệu trưởng (BE vẫn kiểm quyền). */
export const canEditAppearance = (user) => [ROLES.PRINCIPAL, ROLES.VICE_PRINCIPAL].includes(user?.role);
