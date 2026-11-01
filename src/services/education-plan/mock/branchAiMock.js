import { delay } from '@/mocks/mockDatabase';

/*
 * Mock "AI gợi ý tên chủ đề nhánh": chạy bằng luật đơn giản để demo luồng Dùng / Bỏ.
 * AI thật do BE cung cấp (dùng thêm mục tiêu, nội dung đã tích cho chủ đề và nhóm tuổi).
 */

// Gợi ý theo từ khóa trong tên chủ đề, theo thứ tự hay dùng ở trường mầm non
const LIBRARY = [
  ['trường mầm non', ['Trường mầm non của bé', 'Lớp học của bé', 'Cô giáo và các bạn', 'Đồ dùng, đồ chơi trong lớp']],
  ['bản thân', ['Bé là ai', 'Cơ thể của bé', 'Bé cần gì để lớn lên', 'Bé vui khỏe mỗi ngày']],
  ['gia đình', ['Gia đình thân yêu', 'Ngôi nhà của bé', 'Đồ dùng gia đình', 'Họ hàng của bé']],
  ['nghề', ['Nghề nông', 'Nghề xây dựng', 'Nghề y', 'Nghề sản xuất']],
  ['thực vật', ['Cây xanh quanh bé', 'Rau, củ, quả bé thích', 'Các loại hoa', 'Bé chăm sóc cây', 'Cây lương thực']],
  ['tết', ['Mùa xuân của bé', 'Các loại hoa ngày Tết', 'Món ăn ngày Tết', 'Lễ hội mùa xuân', 'Bé vui đón Tết', 'Bé lớn thêm một tuổi']],
  ['động vật', ['Con vật nuôi trong gia đình', 'Con vật sống dưới nước', 'Con vật sống trong rừng', 'Côn trùng và chim']],
  [
    'giao thông',
    [
      'Phương tiện giao thông đường bộ',
      'Phương tiện giao thông đường thủy',
      'Phương tiện giao thông đường hàng không',
      'Bé đi đường an toàn',
    ],
  ],
  ['quê hương', ['Quê hương của bé', 'Thủ đô Hà Nội', 'Đất nước Việt Nam tươi đẹp', 'Bác Hồ kính yêu']],
];

// Ngày lễ dương lịch (MM-DD) và âm lịch đã quy đổi theo năm học demo 2026 – 2027
const FESTIVALS = [
  { key: 'trung thu', label: 'Tết Trung thu', dates: ['2026-09-25'], name: 'Vui Tết Trung thu' },
  { key: 'phụ nữ việt nam', label: 'Ngày Phụ nữ Việt Nam', md: '10-20', name: 'Ngày hội của bà, của mẹ' },
  { key: 'nhà giáo', label: 'Ngày Nhà giáo Việt Nam', md: '11-20', name: 'Bé biết ơn thầy cô' },
  { key: 'nguyên đán', label: 'Tết Nguyên đán', dates: ['2027-02-06'], name: 'Bé vui đón Tết' },
  { key: 'phụ nữ 8/3', label: 'Ngày Quốc tế Phụ nữ', md: '03-08', name: 'Món quà tặng bà, tặng mẹ, tặng cô' },
  { key: 'giải phóng', label: 'Ngày Giải phóng miền Nam', md: '04-30', name: 'Mừng ngày thống nhất đất nước' },
  { key: 'sinh nhật bác', label: 'Sinh nhật Bác', md: '05-19', name: 'Bác Hồ kính yêu' },
];

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Ngày lễ của chủ đề rơi vào tuần (tính cả cuối tuần). */
const festivalIn = (theme, week) => {
  const text = (theme.festivals || '').toLowerCase();
  const end = addDays(week.start, 6);
  for (const f of FESTIVALS) {
    if (!text.includes(f.key)) continue;
    const dates = f.dates || [week.start.slice(0, 4), end.slice(0, 4)].map((y) => `${y}-${f.md}`);
    const hit = dates.find((d) => d >= week.start && d <= end);
    if (hit) return { ...f, date: hit };
  }
  return null;
};

// Viết lại tên cho gần gũi với trẻ: vài tên quen thuộc có sẵn bản hay hơn, còn lại ghép theo mẫu câu
const REWRITES = {
  'lớp học của bé': 'Lớp học yêu thương của bé',
  'cô giáo và các bạn': 'Cô giáo hiền và những người bạn thân',
  'bé là ai': 'Bé là ai – bé tự giới thiệu mình',
  'cơ thể của bé': 'Khám phá cơ thể diệu kỳ của bé',
  'gia đình thân yêu': 'Mái ấm gia đình thân yêu',
  'ngôi nhà của bé': 'Ngôi nhà nhỏ ấm áp của bé',
  'nghề nông': 'Bác nông dân chăm chỉ',
  'các loại hoa': 'Vườn hoa rực rỡ sắc màu',
  'con vật sống dưới nước': 'Thế giới dưới nước kỳ thú',
  'vui tết trung thu': 'Rước đèn vui Tết Trung thu',
};
const TEMPLATES = ['Bé vui khám phá {x}', 'Cùng bé tìm hiểu {x}', '{X} quanh bé', 'Bé yêu {x}'];
// Tên đã bắt đầu bằng "Bé" thì không ghép thêm "bé" lần nữa
const BE_TEMPLATES = ['{X} cùng cô và các bạn', '{X} thật vui', 'Ngày vui: {x}', '{X} mỗi ngày'];
// Giữ hoa chữ đầu với tên riêng (Tết, Bác Hồ, Hà Nội…)
const lowerFirst = (t) => (/^(Tết|Bác|Hà|Việt|Trung)(\s|$)/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
const upperFirst = (t) => t.charAt(0).toUpperCase() + t.slice(1);

export const branchAiMock = {
  /** input: { name, themeName, attempt } → { name }: một cách đặt tên hay hơn (mỗi lần bấm một kiểu khác). */
  async rewriteBranchName({ name, attempt = 0 }) {
    await delay(500);
    const base = name.trim();
    const known = REWRITES[base.toLowerCase()];
    if (known && attempt % (TEMPLATES.length + 1) === 0) return { name: known };
    const list = /^bé(\s|$)/i.test(base) ? BE_TEMPLATES : TEMPLATES;
    const tpl = list[attempt % list.length];
    return { name: upperFirst(tpl.replace('{x}', lowerFirst(base)).replace('{X}', upperFirst(base))) };
  },

  /**
   * input: { themes: [{ id, name, festivals, weeks: [{ start, no }] }], taken: string[] }
   * Trả { suggestions: [{ weekStart, name, reason }] } — bản nháp, giáo viên chọn Dùng / Bỏ.
   */
  async suggestBranchNames({ themes, taken = [] }) {
    await delay(700);
    const used = new Set(taken.map((x) => x.trim().toLowerCase()));
    const suggestions = [];
    themes.forEach((theme) => {
      const lower = theme.name.toLowerCase();
      const pool = [...(LIBRARY.find(([k]) => lower.includes(k))?.[1] || [])];
      const take = (name) => {
        used.add(name.toLowerCase());
        return name;
      };
      theme.weeks.forEach((week, i) => {
        const fest = festivalIn(theme, week);
        if (fest && !used.has(fest.name.toLowerCase())) {
          suggestions.push({ weekStart: week.start, name: take(fest.name), reason: `Tuần có ${fest.label} (${ddmm(fest.date)})` });
          return;
        }
        const next = pool.find((n) => !used.has(n.toLowerCase()));
        suggestions.push(
          next
            ? { weekStart: week.start, name: take(next), reason: `Theo chủ đề "${theme.name}"` }
            : { weekStart: week.start, name: take(`${theme.name} (nhánh ${i + 1})`), reason: 'Chưa có gợi ý phù hợp, cần đặt lại tên' },
        );
      });
    });
    return { suggestions };
  },
};
