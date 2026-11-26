import { axiosClient } from '@/services/http/axiosClient';
import { beClient } from '@/services/http/beClient';

/*
 * BE: SchoolAppearanceController (GET công khai, PUT Hiệu trưởng / Phó hiệu trưởng).
 * Cùng tên hàm và tham số với mock repository. Chưa đăng nhập (màn đăng nhập) dùng axiosClient: beClient nạp danh sách năm học
 * cần token nên không gọi được; skipAuthRefresh để lỗi 401 không kích hoạt luồng hết phiên.
 */
export const appearanceApi = {
  getAppearance: (user) =>
    user ? beClient.get('/school/appearance') : axiosClient.get('/school/appearance', { skipAuthRefresh: true }),
  saveAppearance: (form) =>
    beClient.put('/school/appearance', {
      mode: form.mode,
      pinnedSceneId: form.pinnedSceneId,
      enabledSceneIds: form.enabledSceneIds,
    }),
};
