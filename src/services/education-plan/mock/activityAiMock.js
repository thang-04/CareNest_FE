import { delay } from '@/mocks/mockDatabase';

/*
 * Mock "AI gợi ý hoạt động" cho thẻ hoạt động của kế hoạch chủ đề (EDU-20 mở rộng, Tiền 13/11/2026: chỉ làm FE với dữ liệu giả;
 * BE chưa có API). Luật đơn giản: loại giờ theo cụm từ của MT/nội dung, tên lấy từ nội dung đầu tiên. AI chỉ tạo bản nháp,
 * giáo viên giữ hoặc bỏ từng gợi ý (EDU-20); BE thật sẽ dùng thêm chủ đề, nhóm tuổi và kế hoạch đã duyệt của trường.
 */

// Khớp nguyên cụm từ (tránh "ăn" trong "thăng", "nước" trong "đất nước"); thứ tự là thứ tự ưu tiên
const SLOT_RULES = [
  ['the_duc', ['hô hấp', 'bài tập thể dục', 'động tác']],
  ['an_ngu', ['ăn', 'uống', 'thực phẩm', 'món ăn', 'bữa ăn', 'rửa tay', 'lau mặt', 'súc miệng', 'ngủ']],
  ['tro_chuyen', ['chào', 'lễ phép', 'cảm ơn', 'xin lỗi', 'cảm xúc', 'bố mẹ', 'gia đình', 'giới tính', 'bé thích', 'bác hồ']],
  ['goc', ['vẽ', 'nặn', 'xé', 'dán', 'xếp chồng', 'tạo hình', 'sản phẩm', 'đóng vai', 'phân vai', 'sách', 'tranh']],
  // "bật"/"bò" đứng một mình dễ nhầm ("nổi bật", "con bò") ⇒ dùng cụm vận động
  [
    'ngoai_troi',
    [
      'vận động',
      'thăng bằng',
      'chạy',
      'bò trong',
      'bò chui',
      'bò trườn',
      'trườn',
      'bật xa',
      'bật tại chỗ',
      'bật về',
      'ném',
      'tung',
      'bắt bóng',
      'đi kiễng',
      'đường hẹp',
      'bục',
    ],
  ],
];

const words = (s) =>
  ` ${String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
export const slotFor = (text) => {
  const w = words(text);
  return SLOT_RULES.find(([, phrases]) => phrases.some((p) => w.includes(` ${p} `)))?.[0] || 'hoc';
};

const clean = (line) =>
  String(line || '')
    .replace(/^[-+•]\s*/, '')
    .replace(/[.;]+$/, '')
    .trim();

const NAME_PREFIX = { the_duc: 'Bài tập', ngoai_troi: 'Trò chơi vận động', goc: 'Góc chơi', tro_chuyen: 'Trò chuyện' };

/** input: { themeName, goals: [{ id, no, text, lines: [nội dung] }] } ⇒ [{ goalId, slot, name }] (mỗi MT một gợi ý). */
async function suggestActivityCards({ goals = [] }) {
  await delay(600);
  return goals.map((g) => {
    const first = clean(g.lines?.[0]) || clean(g.text);
    const slot = slotFor(`${g.text} ${first}`);
    // Bỏ nhãn ngắn đầu dòng của Bộ ("Hô hấp:", "Tay:"), giữ nguyên câu dài có dấu hai chấm ("Trả lời câu hỏi: ai?…")
    const head = first.includes(':') ? first.slice(0, first.indexOf(':')) : '';
    const body = head && head.split(/\s+/).length <= 3 ? first.slice(first.indexOf(':') + 1).trim() : first;
    return { goalId: String(g.id), slot, name: NAME_PREFIX[slot] ? `${NAME_PREFIX[slot]}: ${body}` : body };
  });
}

export const activityAiMock = { suggestActivityCards };
