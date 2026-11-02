import { delay } from '@/mocks/mockDatabase';

/*
 * Mock "AI gợi ý tiến trình giờ học": dựng khung a) Ổn định, b) Nội dung trọng tâm, c) Kết thúc theo mẫu Thái Dương
 * từ môn, đề tài (mỗi dòng một hoạt động) và câu MT của giờ. Chỉ là bản nháp để demo luồng Giữ / Bỏ; AI thật do BE cung cấp.
 */
export const lessonAiMock = {
  async suggestLessonSteps({ subject = '', topics = [], goals = [] }) {
    await delay(400);
    const main = topics[0] || subject || 'bài học';
    const aim = goals.length ? `Hướng tới: ${goals.join('; ')}` : '';
    return {
      a: {
        teacher: `- Cô tập trung trẻ, trò chuyện gợi mở về nội dung "${main}".\n- Giới thiệu hoạt động hôm nay.`,
        child: '- Trẻ trò chuyện cùng cô.\n- Trẻ lắng nghe.',
      },
      b: {
        teacher: [
          ...topics.map(
            (t, i) => `Hoạt động ${i + 1}: ${t}\n- Cô giới thiệu, làm mẫu / hướng dẫn.\n- Cho trẻ thực hiện, cô quan sát, sửa sai.`,
          ),
          aim,
        ]
          .filter(Boolean)
          .join('\n'),
        child: topics.map((t, i) => `Hoạt động ${i + 1}:\n- Trẻ quan sát.\n- Trẻ thực hiện.`).join('\n'),
      },
      c: {
        teacher: '- Cô nhận xét, tuyên dương trẻ.\n- Chuyển hoạt động.',
        child: '- Trẻ lắng nghe.',
      },
    };
  },
};
