/*
 * Dữ liệu demo kế hoạch giáo dục (thay toàn bộ dữ liệu mẫu cũ kiểu Yên Định, 14/10/2026).
 * Một luồng liền mạch cho khối Mẫu giáo nhỡ (4–5 tuổi), năm học 2026 – 2027, trường mẫu Thượng Hồng:
 *   1. Kế hoạch năm (mục tiêu, nội dung, 9 chủ đề, 2 đợt nghỉ) ở trạng thái Nháp, chưa ai ký
 *      → Tổ trưởng ký, Phó HT ký, Tổ trưởng gửi, Phó HT ban hành.
 *   2. Sau khi ban hành, lớp Chồi 1 có sẵn bản nháp chủ đề nhánh, kế hoạch chủ đề "Trường mầm non" và giáo án tuần 1
 *      để giáo viên chỉ cần xem, ký, gửi duyệt (Tổ trưởng → Phó HT). Lớp Chồi 2 để trống để lập từ đầu.
 * Nội dung tự soạn cho demo; không có dữ liệu trẻ hay tên người thật (tên là tài khoản demo).
 */
import { emptyBranchPlan, emptyThemePlan, emptyWeekPlan, yearWeeks } from '@/models/education-plan/classPlan';

/** Đổi giá trị này khi thay bộ dữ liệu demo: trình duyệt đang giữ dữ liệu cũ sẽ tự nạp bộ mới. */
export const EDU_SEED_VERSION = 'thai-duong-demo-2026-10-14b';

const YEAR = '2026 – 2027';
const PLAN_ID = 'g-mgn-2627';

const THEMES = [
  {
    id: 't-tmn',
    name: 'Trường mầm non',
    abbr: 'TMN',
    start: '2026-09-07',
    end: '2026-09-25',
    festivals: 'Ngày hội đến trường, Tết Trung thu',
  },
  { id: 't-bt', name: 'Bản thân', abbr: 'BT', start: '2026-09-28', end: '2026-10-16', festivals: 'Ngày Phụ nữ Việt Nam 20/10' },
  { id: 't-gd', name: 'Gia đình', abbr: 'GĐ', start: '2026-10-19', end: '2026-11-13', festivals: '' },
  { id: 't-nn', name: 'Nghề nghiệp', abbr: 'NN', start: '2026-11-16', end: '2026-12-11', festivals: 'Ngày Nhà giáo Việt Nam 20/11' },
  { id: 't-tv', name: 'Thế giới thực vật', abbr: 'TV', start: '2026-12-14', end: '2027-01-15', festivals: '' },
  { id: 't-tmx', name: 'Tết và mùa xuân', abbr: 'TMX', start: '2027-01-18', end: '2027-02-26', festivals: 'Tết Nguyên đán' },
  { id: 't-dv', name: 'Thế giới động vật', abbr: 'ĐV', start: '2027-03-01', end: '2027-03-26', festivals: 'Ngày Quốc tế Phụ nữ 8/3' },
  { id: 't-gt', name: 'Phương tiện và luật giao thông', abbr: 'GT', start: '2027-03-29', end: '2027-04-16', festivals: '' },
  {
    id: 't-qh',
    name: 'Quê hương – Đất nước – Bác Hồ',
    abbr: 'QH',
    start: '2027-04-19',
    end: '2027-05-14',
    festivals: 'Ngày Giải phóng miền Nam 30/4, Sinh nhật Bác 19/5',
  },
].map((t) => ({ ...t, note: '' }));

const BREAKS = [
  { id: 'b-ontap', label: 'Ôn tập, đánh giá cuối học kỳ I', start: '2027-01-04', end: '2027-01-08' },
  { id: 'b-tet', label: 'Nghỉ Tết Nguyên đán', start: '2027-02-08', end: '2027-02-19' },
];

const ALL = THEMES.map((t) => t.id);
const T = (...abbrs) => abbrs.map((a) => THEMES.find((t) => t.abbr === a).id);

/* Hàng của bảng mục tiêu theo lĩnh vực: sub = lĩnh vực con, group = nhóm kết quả mong đợi, goal = mục tiêu + nội dung (tích chủ đề). */
const sub = (text) => ({ kind: 'sub', text });
const group = (text) => ({ kind: 'group', text });
const goal = (text, contents) => ({ kind: 'goal', text, contents: contents.map(([c, themes]) => ({ text: c, themes })) });

const DOMAIN_ROWS = {
  'Phát triển thể chất': [
    sub('Phát triển vận động'),
    group('Thực hiện được các động tác phát triển các nhóm cơ và hô hấp'),
    goal('Trẻ thực hiện đúng, đầy đủ, nhịp nhàng các động tác trong bài thể dục theo hiệu lệnh.', [
      ['Hô hấp, tay, lưng – bụng – lườn, chân trong giờ thể dục sáng và bài tập phát triển chung.', ALL],
    ]),
    group('Thể hiện kỹ năng vận động cơ bản và các tố chất trong vận động'),
    goal('Trẻ giữ được thăng bằng cơ thể khi thực hiện vận động.', [
      ['Đi trên ghế thể dục, đầu đội túi cát.', T('TMN', 'GĐ')],
      ['Đi, chạy thay đổi tốc độ, hướng theo hiệu lệnh.', T('BT', 'GT')],
    ]),
    goal('Trẻ phối hợp tay – mắt trong vận động tung, ném, bắt.', [
      ['Tung, bắt bóng với người đối diện khoảng cách 3 m.', T('TMN', 'NN')],
      ['Ném xa bằng một tay, ném trúng đích nằm ngang.', T('ĐV', 'TV')],
    ]),
    sub('Giáo dục dinh dưỡng và sức khỏe'),
    group('Biết một số món ăn, thực phẩm thông thường và ích lợi của chúng'),
    goal('Trẻ kể được tên một số thức ăn cần có trong bữa ăn hằng ngày.', [
      ['Nhận biết, phân loại một số thực phẩm theo 4 nhóm.', T('BT', 'GĐ')],
      ['Làm quen với một số món ăn ngày Tết.', T('TMX')],
    ]),
    group('Có một số hành vi, thói quen tốt trong sinh hoạt và giữ gìn sức khỏe'),
    goal('Trẻ biết rửa tay bằng xà phòng trước khi ăn, sau khi đi vệ sinh.', [
      ['Tập rửa tay, lau mặt, đánh răng đúng cách.', T('TMN', 'BT', 'GĐ')],
    ]),
  ],
  'Phát triển nhận thức': [
    sub('Khám phá khoa học'),
    goal('Trẻ phân loại được các đối tượng theo một hoặc hai dấu hiệu.', [
      ['Phân loại đồ dùng, đồ chơi theo chất liệu, công dụng.', T('TMN', 'GĐ')],
      ['Phân loại con vật theo môi trường sống.', T('ĐV')],
      ['Phân loại cây, hoa, quả theo đặc điểm.', T('TV')],
    ]),
    goal('Trẻ nhận xét được mối quan hệ đơn giản của sự vật, hiện tượng.', [
      ['Quá trình phát triển của cây; điều kiện sống của cây.', T('TV')],
      ['Một số hiện tượng thời tiết theo mùa.', T('TMX', 'QH')],
    ]),
    sub('Làm quen với một số khái niệm sơ đẳng về toán'),
    goal('Trẻ đếm trên đối tượng trong phạm vi 10 và đếm theo khả năng.', [
      ['Đếm đến 5, nhận biết các nhóm có 5 đối tượng, nhận biết số 5.', T('BT', 'GĐ')],
      ['Đếm đến 8, so sánh thêm bớt trong phạm vi 8.', T('NN', 'ĐV')],
    ]),
    goal('Trẻ sử dụng đúng từ chỉ vị trí của đồ vật so với bản thân.', [
      ['Xác định phía trên – dưới, trước – sau, phải – trái của bản thân.', T('BT', 'GT')],
    ]),
    sub('Khám phá xã hội'),
    goal('Trẻ nói được tên, địa chỉ trường, lớp, tên cô giáo và bạn trong lớp.', [
      ['Trò chuyện về trường, lớp, cô giáo, các bạn.', T('TMN')],
    ]),
    goal('Trẻ kể được tên, công việc, dụng cụ của một số nghề phổ biến.', [
      ['Tìm hiểu nghề nông, nghề xây dựng, nghề giáo viên, bác sĩ.', T('NN')],
    ]),
  ],
  'Phát triển ngôn ngữ': [
    group('Nghe hiểu lời nói'),
    goal('Trẻ thực hiện được 2–3 yêu cầu liên tiếp.', [['Nghe hiểu và làm theo yêu cầu của cô trong các hoạt động.', ALL]]),
    goal('Trẻ nghe hiểu nội dung truyện kể, thơ, đồng dao phù hợp độ tuổi.', [
      ['Truyện "Đôi bạn tốt", thơ "Bàn tay cô giáo".', T('TMN', 'NN')],
      ['Thơ "Hoa kết trái", truyện "Sự tích bánh chưng".', T('TV', 'TMX')],
    ]),
    group('Sử dụng lời nói trong cuộc sống hằng ngày'),
    goal('Trẻ kể lại sự việc theo trình tự, đọc thuộc bài thơ, đồng dao.', [
      ['Kể lại truyện đã nghe; đọc thơ diễn cảm.', T('BT', 'GĐ', 'ĐV', 'QH')],
    ]),
    group('Làm quen với việc đọc – viết'),
    goal('Trẻ nhận dạng được một số chữ cái.', [['Làm quen chữ cái o, ô, ơ; a, ă, â; e, ê.', T('GĐ', 'NN', 'TV')]]),
  ],
  'Phát triển tình cảm và kỹ năng xã hội': [
    goal('Trẻ nói được điều bé thích, không thích, những việc bé làm được.', [['Trò chuyện về sở thích, khả năng của bản thân.', T('BT')]]),
    goal('Trẻ biết chào hỏi, cảm ơn, xin lỗi phù hợp tình huống.', [['Thực hành lễ giáo: chào hỏi, cảm ơn, xin lỗi.', ALL]]),
    goal('Trẻ biết giữ gìn, bảo vệ môi trường xanh – sạch – đẹp.', [['Nhặt lá, tưới cây, bỏ rác đúng nơi quy định.', T('TV', 'QH')]]),
  ],
  'Phát triển thẩm mỹ': [
    goal('Trẻ hát đúng giai điệu, lời ca và thể hiện sắc thái bài hát.', [
      ['Hát "Trường chúng cháu là trường mầm non", "Cô giáo".', T('TMN', 'NN')],
      ['Hát "Sắp đến Tết rồi", "Mùa xuân".', T('TMX')],
    ]),
    goal('Trẻ phối hợp các kỹ năng vẽ, nặn, cắt, dán để tạo ra sản phẩm.', [
      ['Vẽ, tô màu chân dung bạn; nặn đồ dùng gia đình.', T('BT', 'GĐ')],
      ['Cắt, dán hoa, lá, con vật từ giấy màu.', T('TV', 'ĐV')],
    ]),
  ],
};

let rowSeq = 0;
const rowsOf = (domain) =>
  DOMAIN_ROWS[domain].map((r) => {
    const id = `${PLAN_ID}-r${(rowSeq += 1)}`;
    return r.kind === 'goal'
      ? { id, kind: 'goal', text: r.text, contents: r.contents.map((c, k) => ({ ...c, id: `${id}-c${k + 1}` })) }
      : { id, ...r };
  });

const buildYearPlan = () => {
  rowSeq = 0;
  let no = 0;
  const domains = Object.keys(DOMAIN_ROWS).map((name, i) => {
    const rows = rowsOf(name);
    // items: danh sách mục tiêu (số MT) để các màn đọc mục tiêu năm kiểu cũ vẫn dùng được
    const items = rows
      .filter((r) => r.kind === 'goal')
      .map((r) => ({ id: r.id, code: `MT${(no += 1)}`, text: r.text, contents: r.contents, requirements: [] }));
    return { id: `${PLAN_ID}-d${i + 1}`, name, rows, items };
  });
  return {
    id: PLAN_ID,
    code: 'KHNH-2627-MGN',
    schoolYear: YEAR,
    ageGroupId: 'ag-4',
    title: 'Kế hoạch giáo dục năm học 2026 – 2027 khối Mẫu giáo nhỡ',
    description: 'Dữ liệu demo: soạn xong nội dung, chờ Tổ trưởng và Phó hiệu trưởng ký, gửi và ban hành.',
    status: 'DRAFT',
    createdAt: '2026-08-20',
    createdBy: 'Trần Thu Hà',
    sentAt: null,
    file: null,
    domains,
    themes: THEMES,
    breaks: BREAKS,
    builders: [],
    issued: null,
    history: [],
  };
};

/* ---------- Bản nháp của lớp Chồi 1 (hiện ra sau khi kế hoạch năm được ban hành) ---------- */

const CLASS_ID = 'cls_c1_c1';
const BRANCH_NAMES = [
  'Lớp học của bé',
  'Cô giáo và các bạn',
  'Vui Tết Trung thu',
  'Bé là ai',
  'Cơ thể của bé',
  'Bé cần gì để lớn lên',
  'Gia đình thân yêu',
  'Ngôi nhà của bé',
  'Đồ dùng gia đình',
  'Ngày hội của bà, của mẹ',
  'Nghề nông',
  'Nghề xây dựng',
  'Cô giáo của em',
  'Bác sĩ của bé',
  'Cây xanh quanh bé',
  'Hoa đẹp quanh bé',
  'Rau, củ, quả',
  'Cây lương thực',
  'Bé đón Tết',
  'Mùa xuân của bé',
  'Hoa ngày Tết',
  'Lễ hội mùa xuân',
  'Con vật nuôi trong gia đình',
  'Con vật sống dưới nước',
  'Con vật sống trong rừng',
  'Côn trùng',
  'Phương tiện giao thông đường bộ',
  'Phương tiện giao thông đường thủy',
  'Bé đi đường an toàn',
  'Quê hương của bé',
  'Thủ đô Hà Nội',
  'Bác Hồ kính yêu',
  'Bé chuẩn bị vào lớp Lá',
];

const buildClassDocs = (plan) => {
  const weeks = yearWeeks(plan).filter((w) => w.type === 'week');
  const branch = {
    ...emptyBranchPlan({ classId: CLASS_ID, yearPlanId: PLAN_ID }),
    names: Object.fromEntries(weeks.map((w, i) => [w.start, BRANCH_NAMES[i] || ''])),
  };

  const theme = emptyThemePlan({ classId: CLASS_ID, yearPlanId: PLAN_ID, themeId: 't-tmn' });
  theme.envIn =
    '- Trang trí lớp theo chủ đề "Trường mầm non": tranh ảnh về trường, lớp, cô và bạn.\n- Góc phân vai: bán hàng, bác sĩ; góc xây dựng: xây trường mầm non.';
  theme.envOut = '- Sân trường sạch, an toàn; đồ chơi ngoài trời được kiểm tra.\n- Khu vườn cổ tích, góc thiên nhiên cho trẻ chăm sóc cây.';
  // Hoạt động giáo dục của các mục tiêu đã tích cho chủ đề TMN (nội dung lấy từ kế hoạch năm khi mở trang)
  const ACT = {
    'Trẻ thực hiện đúng, đầy đủ, nhịp nhàng các động tác trong bài thể dục theo hiệu lệnh.':
      'TDS: tập theo nhạc bài "Trường chúng cháu là trường mầm non".\nHĐ học: bài tập phát triển chung đầu giờ thể chất.',
    'Trẻ giữ được thăng bằng cơ thể khi thực hiện vận động.':
      'HĐ học: Đi trên ghế thể dục, đầu đội túi cát.\nChơi ngoài trời: trò chơi "Ai đi giỏi".',
    'Trẻ nói được tên, địa chỉ trường, lớp, tên cô giáo và bạn trong lớp.':
      'HĐ học: Trò chuyện về trường mầm non của bé.\nĐón trẻ: trò chuyện về lớp, cô, bạn.',
  };
  theme.rows = Object.fromEntries(
    plan.domains.flatMap((d) =>
      d.rows
        .filter((r) => r.kind === 'goal' && r.contents.some((c) => c.themes.includes('t-tmn')))
        .map((r) => [
          r.id,
          {
            contents: r.contents
              .filter((c) => c.themes.includes('t-tmn'))
              .map((c) => `- ${c.text}`)
              .join('\n'),
            activities: ACT[r.text] || '',
          },
        ]),
    ),
  );

  const w1 = weeks[0];
  const week = emptyWeekPlan({ classId: CLASS_ID, yearPlanId: PLAN_ID, weekStart: w1.start, weekNo: w1.no, themeId: w1.theme.id });
  week.aims = {
    knowledge:
      '- Trẻ biết tên lớp, tên cô giáo, tên một số bạn trong lớp.\n- Trẻ biết các khu vực trong lớp và công dụng của đồ dùng, đồ chơi.',
    skills: '- Trẻ chào hỏi lễ phép; cất dọn đồ chơi đúng nơi quy định.\n- Trẻ đi trên ghế thể dục giữ được thăng bằng.',
    attitude: '- Trẻ vui vẻ đến lớp, yêu quý cô giáo và các bạn.',
  };
  week.prep = '- Tranh ảnh về lớp học, đồ dùng đồ chơi trong lớp.\n- Ghế thể dục, túi cát; nhạc bài hát về trường mầm non.';
  week.grid.don.common = 'Cô đón trẻ, nhắc trẻ chào cô, chào bố mẹ, cất đồ dùng đúng nơi quy định.';
  week.grid.tro_chuyen.common = 'Trò chuyện về lớp học của bé: tên lớp, tên cô, các góc chơi trong lớp.';
  week.grid.the_duc.common = 'Hô hấp, tay, bụng, chân theo nhạc bài "Trường chúng cháu là trường mầm non".';
  week.grid.hoc.days = [
    { subject: 'Phát triển thể chất', topic: 'Đi trên ghế thể dục đầu đội túi cát' },
    { subject: 'Khám phá xã hội', topic: 'Lớp học của bé' },
    { subject: 'Làm quen chữ viết', topic: 'Thơ "Bàn tay cô giáo"' },
    { subject: 'Toán', topic: 'Ôn số lượng trong phạm vi 4' },
    { subject: 'Âm nhạc', topic: 'Hát "Trường chúng cháu là trường mầm non"' },
  ];
  week.grid.ngoai_troi.days = [
    'Quan sát sân trường; TC "Ai đi giỏi"',
    'Nhặt lá vàng; TC "Mèo đuổi chuột"',
    'Vẽ phấn trên sân',
    'Quan sát vườn trường',
    'Chơi tự do với đồ chơi ngoài trời',
  ];
  week.grid.goc.common = 'Góc phân vai: cô giáo, bán hàng. Góc xây dựng: xây trường mầm non. Góc nghệ thuật: tô màu tranh lớp học.';
  week.grid.chieu.days = [
    'Làm quen bài thơ mới',
    'Chơi ở các góc theo ý thích',
    'Rèn kỹ năng rửa tay',
    'Ôn bài hát trong tuần',
    'Nêu gương cuối tuần',
  ];
  week.grid.tra_tre.common = 'Vệ sinh cá nhân, trao đổi với phụ huynh về tình hình của trẻ trong ngày.';
  const d1 = week.days[0];
  d1.aims = '- Trẻ biết đi trên ghế thể dục, đầu đội túi cát, giữ được thăng bằng.\n- Trẻ hứng thú tham gia vận động.';
  d1.prep = '- 2 ghế thể dục, túi cát đủ cho trẻ; sân tập sạch, an toàn.';
  d1.steps['hoc.a'] = {
    teacher: 'Cô cho trẻ hát "Trường chúng cháu là trường mầm non", trò chuyện về giờ thể dục.',
    child: 'Trẻ hát cùng cô, trả lời câu hỏi.',
    note: '',
  };
  d1.steps['hoc.b'] = {
    teacher: 'Khởi động; trọng động: cô làm mẫu 2 lần, phân tích động tác; cho trẻ thực hiện 2–3 lần; TCVĐ "Kéo co".',
    child: 'Trẻ quan sát, thực hiện bài tập, tham gia trò chơi.',
    note: 'Chú ý trẻ yếu',
  };
  d1.steps['hoc.c'] = { teacher: 'Hồi tĩnh nhẹ nhàng, nhận xét, tuyên dương trẻ.', child: 'Trẻ đi nhẹ nhàng 1–2 vòng.', note: '' };
  d1.steps['ngoai_troi.x'] = {
    teacher: 'Cho trẻ quan sát sân trường, chơi "Ai đi giỏi".',
    child: 'Trẻ quan sát, chơi theo hướng dẫn.',
    note: '',
  };
  d1.steps['chieu.x'] = { teacher: 'Cho trẻ làm quen bài thơ "Bàn tay cô giáo".', child: 'Trẻ đọc theo cô.', note: '' };
  return { branch, theme, week };
};

export const buildSeedEducationPlans = () => {
  const plan = buildYearPlan();
  const { branch, theme, week } = buildClassDocs(plan);
  return {
    eduGoals: [plan],
    // Dữ liệu kế hoạch chủ đề / giáo án kiểu cũ: bỏ hẳn (màn mới dùng eduClass*)
    eduThemes: [],
    eduLessons: [],
    eduClassBranch: [branch],
    eduClassTheme: [theme],
    eduClassWeek: [week],
  };
};

/** Nạp bộ demo mới khi dữ liệu trong trình duyệt là bộ cũ. Trả true nếu đã thay. */
export const ensureEduDemo = (db) => {
  if (db.eduSeedVersion === EDU_SEED_VERSION) return false;
  Object.assign(db, buildSeedEducationPlans(), { eduSeedVersion: EDU_SEED_VERSION });
  return true;
};
