import { delay } from '@/mocks/mockDatabase';

/*
 * Bản giả cho chế độ mock của "AI gom nội dung vào chủ đề" (BE:EDU-103). AI thật và bước lọc chống bịa chạy ở BE;
 * bản giả không gợi ý gì để màn hình chạy được khi không có máy chủ.
 */
export const themeContentAiMock = {
  async matchThemeContents() {
    await delay(400);
    return { matches: [], failedDomains: [] };
  },
  // BE:EDU-104 bản giả: một nguồn nhỏ để màn hình chạy được khi không có máy chủ
  async getPreviousYearTicks() {
    await delay(200);
    return {
      source: { planId: 1, code: 'MOCK', schoolYearId: 1, schoolYearName: 'Năm học trước', versionNo: 1 },
      reason: null,
      themes: [{ id: 1, name: 'Trường mầm non' }],
      ticks: [],
    };
  },
  async sendAiFeedback() {
    await delay(50);
    return null;
  },
};
