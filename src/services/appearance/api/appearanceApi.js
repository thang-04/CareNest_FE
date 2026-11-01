import { axiosClient } from '@/services/http/axiosClient';

/*
 * PROPOSED endpoints only – contract chưa thống nhất với CareNest_BE (xem docs/plans/active/2026-10-09-giao-dien-tranh-nen.md).
 * Cùng tên hàm và tham số với mock repository; người dùng lấy từ JWT nên bỏ qua `user`.
 */
export const appearanceApi = {
  getAppearance: () => axiosClient.get('/school/appearance'),
  saveAppearance: (form) => axiosClient.put('/school/appearance', form),
};
