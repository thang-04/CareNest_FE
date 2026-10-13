import { delay } from '@/mocks/mockDatabase';
import { WEEK_ROWS, WEEKDAY_LABELS, ddmm } from '@/models/education-plan/yearPlanModel';

/*
 * Nháp AI giả lập (chưa nối mô hình thật): sinh theo mẫu cố định từ ngữ cảnh màn hình.
 * Trả về { generator, items: [{ key, label, value }] }; key là đường dẫn trường trong tài liệu, màn hình tự chọn dùng hay bỏ.
 * BE thật: POST /education/ai/drafts gọi AI, kiểm tra số MT thuộc kế hoạch năm, chỉ trả nháp.
 */

const GOAL_POOL = {
  TC: [
    [
      'Trẻ giữ được thăng bằng cơ thể khi thực hiện vận động đi, chạy.',
      ['Đi kiễng gót liên tục 3m.', 'Đi, chạy thay đổi tốc độ theo hiệu lệnh của cô.'],
    ],
    [
      'Trẻ biết một số món ăn, thực phẩm thông thường và ích lợi của chúng đối với sức khỏe.',
      ['Nhận biết một số thực phẩm và món ăn quen thuộc.', 'Làm quen cách đánh răng, lau mặt.'],
    ],
  ],
  NT: [
    [
      'Trẻ quan tâm, hứng thú với các sự vật, hiện tượng gần gũi.',
      ['Tên, đặc điểm nổi bật, công dụng của đồ dùng, đồ chơi quen thuộc.', 'Một vài đặc điểm của cây, con vật quen thuộc.'],
    ],
    [
      'Trẻ đếm trên đối tượng trong phạm vi 5.',
      ['Đếm trên đối tượng trong phạm vi 5 và đếm theo khả năng.', 'So sánh số lượng hai nhóm đối tượng: nhiều hơn, ít hơn.'],
    ],
  ],
  NN: [
    [
      'Trẻ nghe hiểu và thực hiện được yêu cầu đơn giản bằng lời nói.',
      ['Nghe hiểu và làm theo yêu cầu đơn giản.', 'Nghe các bài hát, bài thơ, ca dao, đồng dao phù hợp với độ tuổi.'],
    ],
    ['Trẻ đọc thuộc bài thơ, ca dao, đồng dao.', ['Đọc thơ, ca dao, đồng dao, tục ngữ, hò vè.']],
  ],
  TX: [
    ['Trẻ nói được tên, tuổi, giới tính của bản thân.', ['Tên, tuổi, giới tính của bản thân.', 'Những điều bé thích, không thích.']],
    ['Trẻ biết chào hỏi và nói cảm ơn, xin lỗi khi được nhắc nhở.', ['Cử chỉ, lời nói lễ phép: chào hỏi, cảm ơn, xin lỗi.']],
  ],
  TM: [
    [
      'Trẻ vui sướng, vỗ tay, nói lên cảm nhận khi nghe âm thanh gợi cảm và ngắm nhìn vẻ đẹp nổi bật của sự vật.',
      ['Bộc lộ cảm xúc khi nghe âm thanh gợi cảm, các bài hát, bản nhạc gần gũi.'],
    ],
    [
      'Trẻ sử dụng một số dụng cụ, vật liệu để tạo ra sản phẩm đơn giản.',
      [
        'Sử dụng các nguyên vật liệu tạo hình để tạo ra sản phẩm theo sự gợi ý.',
        'Vẽ các nét thẳng, xiên, ngang tạo thành bức tranh đơn giản.',
      ],
    ],
  ],
};

const BRANCH_POOL = {
  MN: ['Bé vui đến trường', 'Lớp học của bé', 'Ngôi trường thân yêu của bé', 'Cô giáo của bé'],
  BT: ['Bé là ai', 'Cơ thể của bé', 'Bé cần gì để lớn lên và khỏe mạnh', 'Bé vui Tết Trung thu'],
  GĐ: ['Gia đình của bé', 'Ngôi nhà bé ở', 'Đồ dùng trong gia đình', 'Bé kính yêu cô giáo'],
  NN: ['Nghề nông', 'Nghề xây dựng', 'Nghề ở địa phương bé', 'Chú bộ đội của bé'],
  GT: ['Phương tiện giao thông đường bộ', 'Phương tiện giao thông đường thủy', 'Bé đi đường an toàn'],
  TV: ['Cây xanh quanh bé', 'Một số loại rau', 'Một số loại quả', 'Hoa đẹp quanh bé'],
  'T&MX': ['Mùa xuân của bé', 'Bé vui đón Tết', 'Bé chơi Tết'],
  ĐV: ['Động vật nuôi trong gia đình', 'Động vật sống dưới nước', 'Động vật sống trong rừng', 'Côn trùng và chim'],
  TN: ['Nước', 'Thời tiết và các mùa', 'Bé với hiện tượng tự nhiên'],
  'QH-ĐN-BH': ['Quê hương của bé', 'Thành phố Hải Phòng thân yêu', 'Đất nước Việt Nam', 'Bác Hồ kính yêu'],
};

// Môn của giờ Hoạt động học theo thứ trong tuần (gợi ý cân đối 5 lĩnh vực).
const SUBJECTS = ['Thể dục', 'Văn học', 'Tạo hình', 'Toán / Khám phá', 'Âm nhạc'];

const ACTIVITY_BY_DOMAIN = {
  TC: (c) => `- TDS: tập các động tác theo nhạc.\n- HĐ học: Thể dục, ${lower(c)}\n- Chơi HĐ ngoài trời: TCVĐ phù hợp với chủ đề.`,
  NT: (c) => `- HĐ học: Khám phá / Làm quen với toán, ${lower(c)}\n- Chơi HĐ ở các góc: góc học tập, góc sách.`,
  NN: (c) => `- HĐ học: Văn học, ${lower(c)}\n- Chơi HĐ buổi chiều: đọc thơ, kể chuyện theo tranh.`,
  TX: (c) => `- Trò chuyện đầu giờ: ${lower(c)}\n- Chơi HĐ ở các góc: góc phân vai.\n- Mọi lúc mọi nơi: nhắc trẻ chào hỏi, cảm ơn.`,
  TM: (c) => `- HĐ học: Tạo hình / Âm nhạc, ${lower(c)}\n- Chơi HĐ ở các góc: góc nghệ thuật.`,
};

const lower = (s = '') => {
  const t = s.trim().replace(/\.$/, '');
  return t ? t[0].toLowerCase() + t.slice(1) + '.' : '';
};

const item = (key, label, value) => ({ key, label, value });

const builders = {
  /** Mục tiêu năm cho một lĩnh vực. */
  'year-goals': ({ domainKey }) =>
    (GOAL_POOL[domainKey] || []).map(([text, contents], i) => item(`goal.${i}`, `Mục tiêu gợi ý ${i + 1}`, { text, contents })),

  /** Tên chủ đề nhánh cho các tuần của các chủ đề. */
  'branch-names': ({ themes }) =>
    themes.flatMap((t) => {
      const pool = BRANCH_POOL[t.abbr] || [];
      return t.weeks.map((w, i) =>
        item(`names.${w.start}`, `${t.name} · Tuần ${w.no} (${ddmm(w.start)} → ${ddmm(w.end)})`, pool[i] || `${t.name}: nhánh ${i + 1}`),
      );
    }),

  /** Cột Hoạt động giáo dục và môi trường của kế hoạch chủ đề. */
  'theme-activities': ({ themeName, rows }) => [
    ...rows.map((r) =>
      item(
        `rows.${r.goalId}.activities`,
        `MT ${r.no}`,
        (ACTIVITY_BY_DOMAIN[r.domainKey] || ACTIVITY_BY_DOMAIN.NT)(r.contents.split('\n')[0] || r.text),
      ),
    ),
    item(
      'envIn',
      'Môi trường trong lớp',
      `- Tranh ảnh về chủ đề "${themeName}" treo ngang tầm mắt trẻ.\n- Góc phân vai, xây dựng, nghệ thuật, sách truyện có đồ dùng theo chủ đề.`,
    ),
    item(
      'envOut',
      'Môi trường ngoài lớp',
      '- Sân chơi sạch, an toàn; đồ chơi ngoài trời được kiểm tra trước giờ chơi.\n- Góc thiên nhiên có cây, bình tưới cho trẻ chăm sóc.',
    ),
  ],

  /** Kế hoạch tuần: mục đích, chuẩn bị và các ô còn trống của bảng hoạt động. */
  'week-fill': ({ branchName, themeName }) => {
    const b = branchName || themeName;
    const out = [
      item(
        'aims.knowledge',
        'Mục đích: Kiến thức',
        `- Trẻ biết tên, một số đặc điểm nổi bật liên quan đến "${b}".\n- Trẻ biết tên các góc chơi và đồ dùng trong góc.`,
      ),
      item(
        'aims.skills',
        'Mục đích: Kỹ năng',
        '- Rèn kỹ năng quan sát, trả lời câu hỏi rõ ràng.\n- Rèn kỹ năng vận động và phối hợp tay – mắt.',
      ),
      item('aims.attitude', 'Mục đích: Thái độ', '- Trẻ hứng thú tham gia hoạt động, đoàn kết với bạn.'),
      item('prep', 'Chuẩn bị', `- Tranh ảnh, video về "${b}".\n- Hệ thống câu hỏi đàm thoại.\n- Đồ dùng ở các góc chơi theo chủ đề.`),
    ];
    WEEK_ROWS.forEach((r) => {
      if (r.allWeek) {
        const text = {
          don: '- Cô đón trẻ niềm nở, nhắc trẻ chào cô, chào bố mẹ, cất đồ dùng đúng nơi quy định.\n- Trao đổi với phụ huynh về tình hình của trẻ.',
          tro_chuyen: `- Trò chuyện với trẻ về "${b}".`,
          the_duc: '- Khởi động: đi, chạy các kiểu.\n- Trọng động: hô hấp, tay, bụng, chân, bật.\n- Hồi tĩnh: đi nhẹ nhàng.',
          goc: '- Góc phân vai, góc xây dựng, góc nghệ thuật, góc sách truyện theo chủ đề.',
          tra_tre: '- Vệ sinh cho trẻ, nêu gương cuối ngày.\n- Trao đổi với phụ huynh.',
        }[r.key];
        out.push(item(`grid.${r.key}.common`, r.label, text));
        return;
      }
      WEEKDAY_LABELS.forEach((d, i) => {
        const text = {
          hoc: `${SUBJECTS[i]}: đề tài gắn với "${b}".`,
          ngoai_troi: `- Quan sát có chủ đích về "${b}".\n- TCVĐ.\n- Chơi tự do.`,
          chieu: '- Ôn bài buổi sáng.\n- Chơi theo ý thích.',
        }[r.key];
        out.push(item(`grid.${r.key}.days.${i}`, `${r.label} · ${d}`, text));
      });
    });
    return out;
  },

  /** Kế hoạch ngày từ ô Hoạt động học của kế hoạch tuần. */
  'day-plan': ({ dayIndex, topic, branchName }) => {
    const p = `days.${dayIndex}`;
    const t = topic || `Hoạt động học về "${branchName}"`;
    return [
      item(
        `${p}.aims`,
        'Mục đích, yêu cầu',
        `- Trẻ biết tên đề tài "${t}" và thực hiện được theo hướng dẫn của cô.\n- Trẻ hứng thú, tích cực tham gia hoạt động.`,
      ),
      item(`${p}.prep`, 'Chuẩn bị', '- Đồ dùng của cô: tranh, nhạc, đồ dùng trực quan.\n- Đồ dùng của trẻ: đủ cho mỗi trẻ.'),
      item(`${p}.steps.hoc.title`, 'Đề tài hoạt động học', t),
      item(
        `${p}.steps.hoc.teacher`,
        'Hoạt động học: hoạt động của cô',
        `a) Ổn định tổ chức, gây hứng thú:\n- Cô trò chuyện cùng trẻ về "${branchName}".\nb) Nội dung trọng tâm:\nHoạt động 1: Cô giới thiệu, làm mẫu.\nHoạt động 2: Trẻ thực hiện, cô quan sát, sửa sai.\nHoạt động 3: Trò chơi củng cố.\nc) Kết thúc:\n- Cô nhận xét, tuyên dương trẻ.`,
      ),
      item(
        `${p}.steps.hoc.child`,
        'Hoạt động học: hoạt động của trẻ',
        '- Trẻ trò chuyện cùng cô.\n- Trẻ quan sát, lắng nghe.\n- Trẻ thực hiện.\n- Trẻ chơi trò chơi.\n- Trẻ lắng nghe.',
      ),
      item(
        `${p}.steps.ngoai_troi.teacher`,
        'Ngoài trời: hoạt động của cô',
        '- Hoạt động có chủ đích: cô cho trẻ quan sát, đặt câu hỏi gợi mở.\n- TCVĐ: cô giới thiệu cách chơi, luật chơi.\n- Chơi tự do: cô bao quát trẻ.',
      ),
      item(
        `${p}.steps.ngoai_troi.child`,
        'Ngoài trời: hoạt động của trẻ',
        '- Trẻ quan sát, trả lời.\n- Trẻ chơi trò chơi.\n- Trẻ chơi tự do.',
      ),
      item(
        `${p}.steps.chieu.teacher`,
        'Buổi chiều: hoạt động của cô',
        '- Cô cho trẻ ôn lại bài buổi sáng.\n- Cô cho trẻ chơi theo ý thích ở các góc.',
      ),
      item(`${p}.steps.chieu.child`, 'Buổi chiều: hoạt động của trẻ', '- Trẻ ôn bài.\n- Trẻ chơi theo ý thích.'),
    ];
  },
};

export const generatePlanDraft = async (type, context = {}) => {
  await delay(700);
  const build = builders[type];
  if (!build) throw new Error('Loại nháp không hợp lệ');
  return { generator: 'RULE_BASED_FALLBACK', items: build(context) };
};
