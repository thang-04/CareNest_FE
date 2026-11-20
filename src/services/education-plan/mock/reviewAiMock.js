import { delay } from '@/mocks/mockDatabase';

/*
 * Bản giả cho chế độ mock của khung Kiểm tra / Tóm tắt và "Sửa theo yêu cầu" (BE:EDU-95, EDU-96).
 * Tiêu chí và AI thật chạy ở BE; bản giả chỉ để màn hình chạy được khi không có máy chủ.
 */
export const reviewAiMock = {
  async getClassDocChecks() {
    await delay(200);
    return { items: [{ key: 'mock', label: 'Bản giả: tiêu chí kiểm ở máy chủ', ok: true }], passed: 1, total: 1 };
  },
  async editDayByRequest() {
    await delay(400);
    return { changes: [] };
  },
  async reviewDay() {
    await delay(400);
    return { summary: ['Bản giả: tóm tắt AI chạy ở máy chủ.'], notes: [] };
  },
};
