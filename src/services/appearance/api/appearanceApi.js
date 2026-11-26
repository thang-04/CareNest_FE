import { beClient } from '@/services/http/beClient';

/*
 * BE: SchoolAppearanceController (GET mọi người dùng đăng nhập, PUT Hiệu trưởng / Phó hiệu trưởng).
 * Cùng tên hàm và tham số với mock repository; người dùng lấy từ JWT nên bỏ qua `user`.
 */
export const appearanceApi = {
  getAppearance: () => beClient.get('/school/appearance'),
  saveAppearance: (form) =>
    beClient.put('/school/appearance', {
      mode: form.mode,
      pinnedSceneId: form.pinnedSceneId,
      enabledSceneIds: form.enabledSceneIds,
    }),
};
