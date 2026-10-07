import { DOMAINS } from '@/models/education-plan/educationPlanConstants';

/* Seed data for the education-plan module (goals, theme plans, lesson plans). */

const CURRENT_YEAR = '2026 – 2027';

const goalItems = (prefix, list) => list.map((text, i) => ({ id: `${prefix}-${i + 1}`, code: '', text }));

function numberGoals(domains) {
  let n = 0;
  return domains.map((d) => ({
    ...d,
    items: d.items.map((it) => ({ ...it, code: `MT${++n}` })),
  }));
}

const SEED_GOALS = [
  {
    id: 'g-1',
    code: 'MTNH-2627-MGN',
    schoolYear: CURRENT_YEAR,
    ageGroupId: 'ag-4',
    title: 'Mục tiêu giáo dục năm học 2026 – 2027 nhóm tuổi Mẫu giáo nhỡ',
    description: 'Mục tiêu năm học xây dựng theo Chương trình Giáo dục mầm non, áp dụng cho trẻ 4–5 tuổi tại tất cả cơ sở của trường.',
    status: 'SENT',
    createdAt: '2026-08-20',
    sentAt: '2026-08-22',
    createdBy: 'Nguyễn Thị Lan',
    file: { name: 'Muc_tieu_nam_hoc_MGN_2026-2027_da_ky.pdf', size: '1.4 MB' },
    domains: numberGoals([
      {
        name: DOMAINS[0],
        items: goalItems('g1-tc', [
          'Trẻ chủ động, kiên trì tham gia các vận động và trò chơi vận động.',
          'Trẻ thực hiện đúng, đầy đủ các động tác trong bài tập thể dục theo hiệu lệnh.',
          'Trẻ giữ thăng bằng và phối hợp vận động khi đi, chạy, bật, ném.',
          'Trẻ phối hợp cử động bàn tay, ngón tay trong hoạt động tự phục vụ.',
          'Trẻ có thói quen ăn uống đủ chất, hành vi văn minh trong ăn uống.',
          'Trẻ có thói quen vệ sinh cá nhân và biết giữ an toàn.',
        ]),
      },
      {
        name: DOMAINS[1],
        items: goalItems('g1-nt', [
          'Trẻ tò mò, quan sát và khám phá sự vật, hiện tượng gần gũi.',
          'Trẻ nhận biết đặc điểm, công dụng của đồ dùng, đồ chơi quen thuộc.',
          'Trẻ nói được tên trường, lớp, cô giáo và các khu vực trong trường.',
          'Trẻ nhận biết, gọi tên và phân biệt các hình hình học cơ bản.',
          'Trẻ đếm, nhận biết số lượng trong phạm vi 5.',
          'Trẻ xác định vị trí của đồ vật so với bản thân.',
        ]),
      },
      {
        name: DOMAINS[2],
        items: goalItems('g1-nn', [
          'Trẻ nghe hiểu và thực hiện được yêu cầu bằng lời nói; nghe hiểu thơ, truyện.',
          'Trẻ sử dụng lời nói rõ ràng để giao tiếp, đề nghị, nêu ý kiến.',
          'Trẻ hứng thú với sách, tranh và làm quen với chữ viết.',
        ]),
      },
      {
        name: DOMAINS[3],
        items: goalItems('g1-tx', [
          'Trẻ biết thể hiện nhu cầu, sở thích của bản thân.',
          'Trẻ nhận biết và thể hiện cảm xúc phù hợp.',
          'Trẻ thực hiện nề nếp, nhiệm vụ của mình trong sinh hoạt ở lớp.',
          'Trẻ giao tiếp lễ phép, hợp tác và chia sẻ với bạn bè, người lớn.',
        ]),
      },
      {
        name: DOMAINS[4],
        items: goalItems('g1-ngt', [
          'Trẻ cảm nhận và thể hiện cảm xúc trước vẻ đẹp của trường lớp, thiên nhiên.',
          'Trẻ hát đúng giai điệu, vận động theo nhạc các bài hát quen thuộc.',
          'Trẻ sử dụng nguyên vật liệu, kỹ năng tạo hình để tạo ra sản phẩm.',
        ]),
      },
    ]),
  },
  {
    id: 'g-2',
    code: 'MTNH-2627-MGL',
    schoolYear: CURRENT_YEAR,
    ageGroupId: 'ag-5',
    title: 'Mục tiêu giáo dục năm học 2026 – 2027 nhóm tuổi Mẫu giáo lớn',
    description: 'Mục tiêu năm học cho trẻ 5–6 tuổi, chú trọng chuẩn bị vào lớp 1.',
    status: 'SENT',
    createdAt: '2026-08-21',
    sentAt: '2026-08-22',
    createdBy: 'Nguyễn Thị Lan',
    file: { name: 'Muc_tieu_nam_hoc_MGL_2026-2027_da_ky.pdf', size: '1.2 MB' },
    domains: numberGoals([
      {
        name: DOMAINS[0],
        items: goalItems('g2-d1', ['Trẻ bật xa tối thiểu 50 cm.', 'Trẻ tự cài, cởi cúc áo, buộc dây giày.']),
      },
      {
        name: DOMAINS[2],
        items: goalItems('g2-d3', ['Trẻ nhận biết và phát âm đúng các chữ cái đã học.']),
      },
    ]),
  },
  {
    id: 'g-3',
    code: 'MTNH-2627-MGB',
    schoolYear: CURRENT_YEAR,
    ageGroupId: 'ag-3',
    title: 'Mục tiêu giáo dục năm học 2026 – 2027 nhóm tuổi Mẫu giáo bé',
    description: '',
    status: 'DRAFT',
    createdAt: '2026-10-02',
    sentAt: null,
    createdBy: 'Nguyễn Thị Lan',
    file: null,
    domains: numberGoals([{ name: DOMAINS[0], items: goalItems('g3-d1', ['Trẻ đi, chạy thay đổi tốc độ theo hiệu lệnh.']) }]),
  },
  // Năm học trước – dùng để sao chép mục tiêu
  {
    id: 'g-old-4',
    code: 'MTNH-2526-MGN',
    schoolYear: '2025 – 2026',
    ageGroupId: 'ag-4',
    title: 'Mục tiêu giáo dục năm học 2025 – 2026 nhóm tuổi Mẫu giáo nhỡ',
    description: '',
    status: 'SENT',
    createdAt: '2025-08-18',
    sentAt: '2025-08-20',
    createdBy: 'Nguyễn Thị Lan',
    file: { name: 'Muc_tieu_nam_hoc_MGN_2025-2026_da_ky.pdf', size: '1.3 MB' },
    domains: numberGoals([
      {
        name: DOMAINS[0],
        items: goalItems('go4-d1', [
          'Trẻ thực hiện đúng, đầy đủ các động tác trong bài tập thể dục theo hiệu lệnh.',
          'Trẻ biết tự cầm thìa xúc ăn gọn gàng, không rơi vãi.',
          'Trẻ chạy liên tục 15 m trong khoảng 10 giây.',
        ]),
      },
      {
        name: DOMAINS[1],
        items: goalItems('go4-d2', [
          'Trẻ nhận biết được hình vuông, hình tròn, hình tam giác, hình chữ nhật.',
          'Trẻ phân biệt được hôm qua, hôm nay, ngày mai.',
        ]),
      },
      {
        name: DOMAINS[2],
        items: goalItems('go4-d3', ['Trẻ đọc thuộc bài thơ, ca dao, đồng dao phù hợp độ tuổi.']),
      },
      {
        name: 'Giáo dục an toàn giao thông',
        items: goalItems('go4-d6', [
          'Trẻ biết đi bộ trên vỉa hè, nắm tay người lớn khi qua đường.',
          'Trẻ nhận biết đèn tín hiệu giao thông xanh, đỏ, vàng.',
        ]),
      },
    ]),
  },
  {
    id: 'g-old-2',
    code: 'MTNH-2526-NT',
    schoolYear: '2025 – 2026',
    ageGroupId: 'ag-2',
    title: 'Mục tiêu giáo dục năm học 2025 – 2026 nhóm tuổi Nhà trẻ',
    description: '',
    status: 'SENT',
    createdAt: '2025-08-18',
    sentAt: '2025-08-20',
    createdBy: 'Nguyễn Thị Lan',
    file: { name: 'Muc_tieu_nam_hoc_NT_2025-2026_da_ky.pdf', size: '980 KB' },
    domains: numberGoals([
      {
        name: DOMAINS[0],
        items: goalItems('go2-d1', ['Trẻ đi được theo đường thẳng, đường hẹp.', 'Trẻ biết xúc cơm, uống nước bằng cốc.']),
      },
      {
        name: DOMAINS[2],
        items: goalItems('go2-d3', ['Trẻ nói được câu đơn 3–4 từ.']),
      },
    ]),
  },
];

/* ───────────── Dữ liệu mẫu ───────────── */

const row = (id, goalCode, code, domain, requirement, content, method, form, environment) => ({
  id,
  goalCode,
  code,
  domain,
  requirement,
  content,
  method,
  form,
  environment,
  adjust: '',
});

const TC = 'Phát triển thể chất';
const NT = 'Phát triển nhận thức';
const NN = 'Phát triển ngôn ngữ';
const TX = 'Phát triển tình cảm và kỹ năng xã hội';
const NGT = 'Phát triển thẩm mỹ';

const PP_VD = [
  'Trực quan làm mẫu; luyện tập – thực hành; trò chơi vận động',
  'Cá nhân, nhóm, cả lớp',
  'Sân bằng phẳng, dụng cụ vận động phù hợp, bảo đảm an toàn',
];
const PP_TX = [
  'Trò chuyện, nêu gương, đóng vai, xử lý tình huống',
  'Hợp tác nhóm; tích hợp trong mọi hoạt động',
  'Môi trường thân thiện, có bảng quy ước và góc cảm xúc',
];
const PP_NN = [
  'Đàm thoại gợi mở; đọc diễn cảm, kể chuyện; đóng kịch',
  'Cá nhân – nhóm – cả lớp',
  'Sách tranh, rối, tranh truyện, góc thư viện',
];
const PP_NT = ['Quan sát, so sánh, phân loại; trò chơi học tập', 'Nhóm nhỏ, cả lớp', 'Đồ dùng, đồ chơi thật; thẻ hình; màn hình tương tác'];
const PP_NGT = ['Nghe – hát – vận động; thực hành tạo hình', 'Cá nhân, nhóm', 'Nhạc cụ, giấy, màu, đất nặn, nguyên liệu tái chế'];

const THEME_1_ROWS = [
  row(
    'r1',
    'MT1',
    'TC1.1',
    TC,
    'Trẻ lựa chọn và tham gia các trò chơi vận động trong giờ hoạt động thể chất, không chờ cô nhắc.',
    'Rèn các vận động đi, chạy, bật, giữ thăng bằng; trò chơi gắn với trường, lớp, cô giáo, bạn bè.',
    ...PP_VD,
  ),
  row(
    'r2',
    'MT1',
    'TC1.2',
    TC,
    'Trẻ thực hiện lại vận động khi chưa đạt yêu cầu, cố gắng đến khi hoàn thành.',
    'Ném chưa trúng thì thử lại; bật chạm vật cản thì điều chỉnh; đi mất thăng bằng thì làm lại.',
    ...PP_VD,
  ),
  row(
    'r3',
    'MT3',
    'TC3.1',
    TC,
    'Trẻ đi, chạy qua đường hẹp hoặc có chướng ngại vật, giữ thăng bằng theo yêu cầu.',
    'Đi trong đường hẹp theo hiệu lệnh; trò chơi dân gian Mèo đuổi chuột.',
    ...PP_VD,
  ),
  row(
    'r4',
    'MT4',
    'TC4.2',
    TC,
    'Trẻ cài, mở cúc áo hoặc kéo khóa trong hoạt động tự phục vụ, thực hiện độc lập.',
    'Cài/mở cúc áo; kéo khóa; tự mặc/cởi trang phục đơn giản và cất đồ dùng cá nhân.',
    'Trò chuyện gợi mở; thực hành trải nghiệm; nêu gương',
    'Cá nhân',
    'Đồ dùng cá nhân có ký hiệu',
  ),
  row(
    'r5',
    'MT6',
    'TC6.1',
    TC,
    'Trẻ rửa tay bằng xà phòng trước khi ăn và sau khi đi vệ sinh, thực hiện đủ các bước.',
    'Thực hành vệ sinh cá nhân, ăn uống hợp lý, tự phục vụ và quy tắc an toàn trong trường.',
    'Trò chuyện; thực hành trải nghiệm; xử lý tình huống',
    'Trong giờ ăn, vệ sinh và sinh hoạt hằng ngày',
    'Tranh quy trình rửa tay, xà phòng, khăn',
  ),
  row(
    'r6',
    'MT7',
    'NT1.3',
    NT,
    'Trẻ quan sát và nói được đặc điểm nổi bật của đồ dùng, đồ chơi trong lớp.',
    'Khám phá đồ dùng, đồ chơi và nội quy lớp học.',
    ...PP_NT,
  ),
  row(
    'r7',
    'MT8',
    'NT2.1',
    NT,
    'Trẻ nói được công dụng của một số đồ dùng, đồ chơi quen thuộc.',
    'Trò chuyện, phân loại đồ dùng theo công dụng.',
    ...PP_NT,
  ),
  row(
    'r8',
    'MT10',
    'NT4.2',
    NT,
    'Trẻ nhận biết, gọi đúng tên hình vuông, tròn, tam giác, chữ nhật.',
    'Ôn nhận biết, phân biệt các hình quanh lớp.',
    ...PP_NT,
  ),
  row(
    'r9',
    'MT11',
    'NT5.1',
    NT,
    'Trẻ đếm và nhận biết số lượng trong phạm vi 5.',
    'Đếm đồ chơi, bạn trong nhóm trong phạm vi 5.',
    ...PP_NT,
  ),
  row(
    'r10',
    'MT13',
    'NN1.1',
    NN,
    'Trẻ nhắc lại câu nói gồm 5–7 tiếng sau khi nghe cô nói.',
    'Thơ, truyện về ngày đến trường, cô giáo và tình bạn.',
    ...PP_NN,
  ),
  row(
    'r11',
    'MT13',
    'NN1.3',
    NN,
    'Trẻ thực hiện liên tiếp 2 yêu cầu bằng lời nói trong hoạt động hằng ngày.',
    'Nghe và thực hiện liên tiếp 2 yêu cầu; trao đổi với cô, bạn.',
    ...PP_NN,
  ),
  row(
    'r12',
    'MT14',
    'NN2.2',
    NN,
    'Trẻ dùng từ chỉ người, vật, hoạt động và câu hỏi, câu kể khi trò chuyện.',
    'Mở rộng từ theo chủ đề; nói câu rõ ý; kể chuyện theo tranh.',
    ...PP_NN,
  ),
  row(
    'r13',
    'MT14',
    'NN2.5',
    NN,
    'Trẻ dùng lời chào, cảm ơn, xin lỗi hoặc xin phép trong giao tiếp hằng ngày.',
    'Thực hành lời nói lễ phép trong các tình huống ở trường.',
    ...PP_NN,
  ),
  row(
    'r14',
    'MT16',
    'TX1.2',
    TX,
    'Trẻ nói hoặc dùng cử chỉ để đề nghị nhu cầu của mình trong hoạt động hằng ngày.',
    'Trò chuyện, trải nghiệm tình huống gần gũi để trẻ nói về nhu cầu, sở thích.',
    ...PP_TX,
  ),
  row(
    'r15',
    'MT16',
    'TX1.3',
    TX,
    'Trẻ nói điều mình thích hoặc không thích khi lựa chọn đồ chơi, hoạt động.',
    'Trẻ chọn và chia sẻ lý do lựa chọn đồ chơi, món ăn, hoạt động.',
    ...PP_TX,
  ),
  row(
    'r16',
    'MT18',
    'TX3.1',
    TX,
    'Trẻ thực hiện nhiệm vụ như cất đồ dùng, xếp hàng, chào hỏi trong sinh hoạt ở lớp.',
    'Thực hiện nề nếp và trách nhiệm trong lớp học.',
    ...PP_TX,
  ),
  row(
    'r17',
    'MT19',
    'TX4.1',
    TX,
    'Trẻ chủ động chào hỏi và mời bạn tham gia chơi cùng trong hoạt động góc.',
    'Góc cô giáo – học sinh, bán hàng đồ dùng học tập; thỏa thuận vai.',
    'Chơi đóng vai, hợp tác nhóm',
    'Nhóm nhỏ',
    'Góc mở, đồ chơi mô phỏng, kí hiệu vai chơi',
  ),
  row(
    'r18',
    'MT21',
    'NgT2.1',
    NGT,
    'Trẻ hát đúng giai điệu và vận động theo nhạc các bài hát về trường mầm non.',
    'Hát, vận động: Trường chúng cháu là trường mầm non; Cháu đi mẫu giáo.',
    ...PP_NGT,
  ),
  row(
    'r19',
    'MT22',
    'NgT3.2',
    NGT,
    'Trẻ vẽ, xé dán, nặn tạo sản phẩm về trường lớp, đồ chơi.',
    'Vẽ trường mầm non; làm khung ảnh tình bạn từ bìa và hột hạt.',
    ...PP_NGT,
  ),
];

const THEME_2_ROWS = [
  row(
    's1',
    'MT2',
    'TC2.1',
    TC,
    'Trẻ tập đủ, đúng các động tác thể dục theo nhạc bài “Cái mũi”.',
    'Bài tập phát triển chung; vận động cơ bản bò, bật.',
    ...PP_VD,
  ),
  row(
    's2',
    'MT6',
    'TC6.2',
    TC,
    'Trẻ biết giữ vệ sinh răng miệng, đánh răng đúng cách.',
    'Thực hành đánh răng, rửa tay, lau mặt.',
    'Thực hành',
    'Cá nhân',
    'Bàn chải, cốc, mô hình răng',
  ),
  row('s3', 'MT7', 'NT1.4', NT, 'Trẻ nói được tên và chức năng các bộ phận trên cơ thể.', 'Khám phá cơ thể bé và các giác quan.', ...PP_NT),
  row(
    's4',
    'MT14',
    'NN2.3',
    NN,
    'Trẻ giới thiệu được họ tên, tuổi, sở thích của bản thân.',
    'Trò chuyện “Bé là ai”; thơ “Đôi mắt của em”.',
    ...PP_NN,
  ),
  row(
    's5',
    'MT17',
    'TX2.1',
    TX,
    'Trẻ nhận biết và gọi tên cảm xúc vui, buồn, ngạc nhiên, sợ hãi.',
    'Trò chơi “Khuôn mặt cảm xúc”.',
    ...PP_TX,
  ),
  row('s6', 'MT21', 'NgT2.2', NGT, 'Trẻ hát và vận động minh họa bài “Cái mũi”.', 'Dạy hát, vận động minh họa; nghe hát.', ...PP_NGT),
];

const THEME_3_ROWS = [
  row(
    'u1',
    'MT19',
    'TX4.3',
    TX,
    'Trẻ biết quan tâm, giúp đỡ người thân trong gia đình.',
    'Trò chuyện về các thành viên và công việc trong gia đình.',
    ...PP_TX,
  ),
  row('u2', 'MT9', 'NT3.2', NT, 'Trẻ kể được tên, công việc của các thành viên trong gia đình.', 'Khám phá: Gia đình bé.', ...PP_NT),
  row('u3', 'MT14', 'NN2.6', NN, 'Trẻ kể lại truyện “Ba cô gái” theo trình tự.', 'Kể chuyện, đóng kịch.', ...PP_NN),
];

const branches = (start, names) =>
  names.map((name, i) => {
    const d = new Date(start + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + i * 7);
    const e = new Date(d);
    e.setUTCDate(e.getUTCDate() + 4);
    return { index: i + 1, start: d.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10), name };
  });

const SEED_THEMES = [
  {
    id: 't-1',
    code: 'CD-MGN-01',
    schoolYear: '2026 – 2027',
    ageGroupId: 'ag-4',
    goalId: 'g-1',
    name: 'Bé vui đến trường',
    startDate: '2026-09-07',
    endDate: '2026-09-25',
    weeks: 3,
    branches: branches('2026-09-07', ['Trường mầm non thân yêu', 'Lớp học của bé', 'Cô giáo và các bạn']),
    rows: THEME_1_ROWS,
    note: '',
    status: 'APPROVED',
    createdBy: 'Trần Thu Hà',
    history: [
      { action: 'Tạo và gửi duyệt', by: 'Trần Thu Hà', role: 'Tổ trưởng nhóm tuổi', at: '2026-08-28 09:12', tone: '' },
      { action: 'Phó HT phê duyệt', by: 'Nguyễn Thị Lan', role: 'Phó hiệu trưởng', at: '2026-08-30 14:05', tone: 'ok' },
    ],
  },
  {
    id: 't-2',
    code: 'CD-MGN-02',
    schoolYear: '2026 – 2027',
    ageGroupId: 'ag-4',
    goalId: 'g-1',
    name: 'Bản thân bé',
    startDate: '2026-09-28',
    endDate: '2026-10-23',
    weeks: 4,
    branches: branches('2026-09-28', ['Bé là ai', 'Cơ thể bé', 'Bé cần gì để lớn lên khỏe mạnh', 'Cảm xúc của bé']),
    rows: THEME_2_ROWS,
    note: '',
    status: 'APPROVED',
    createdBy: 'Trần Thu Hà',
    history: [
      { action: 'Tạo và gửi duyệt', by: 'Trần Thu Hà', role: 'Tổ trưởng nhóm tuổi', at: '2026-09-15 10:30', tone: '' },
      { action: 'Phó HT phê duyệt', by: 'Nguyễn Thị Lan', role: 'Phó hiệu trưởng', at: '2026-09-17 08:45', tone: 'ok' },
    ],
  },
  {
    id: 't-3',
    code: 'CD-MGN-03',
    schoolYear: '2026 – 2027',
    ageGroupId: 'ag-4',
    goalId: 'g-1',
    name: 'Gia đình thân yêu',
    startDate: '2026-10-26',
    endDate: '2026-11-20',
    weeks: 4,
    branches: branches('2026-10-26', ['Gia đình bé', 'Ngôi nhà của bé', 'Đồ dùng trong gia đình', 'Nhu cầu của gia đình']),
    rows: THEME_3_ROWS,
    note: '',
    status: 'PENDING_VP',
    createdBy: 'Trần Thu Hà',
    history: [{ action: 'Tạo và gửi duyệt', by: 'Trần Thu Hà', role: 'Tổ trưởng nhóm tuổi', at: '2026-10-05 16:20', tone: '' }],
  },
];

/* Kế hoạch tuần: slots = giờ sinh hoạt; mỗi ô theo ngày có nội dung + mã YCCĐ, hoặc 1 ô chung cả tuần */
const wk = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'];
const cells = (list) => Object.fromEntries(wk.map((d, i) => [d, { text: list[i][0], codes: list[i][1] }]));
const slot = (id, name, data) =>
  Array.isArray(data)
    ? { id, name, allWeek: false, cells: cells(data), all: { text: '', codes: [] } }
    : { id, name, allWeek: true, cells: {}, all: data };

const WEEK_1_SLOTS = [
  slot('w1', 'Đón trẻ – Trò chuyện sáng', [
    ['Trò chuyện về “Trường mầm non thân yêu”; nhắc trẻ cất đồ đúng ngăn tủ.', ['TX1.2', 'TX3.1', 'NN2.5']],
    ['Quan sát tranh về trường mầm non; trò chuyện về việc đến trường.', ['TX1.2', 'TX3.1', 'NN2.5']],
    ['Trò chuyện về tên trường, các khu vực trong trường, công việc của các cô.', ['TX1.2', 'TX3.1', 'NN2.5']],
    ['Trò chuyện “Bé đến trường”; hướng dẫn trẻ chào cô, chào bố mẹ.', ['TX1.2', 'TX3.1', 'NN2.5']],
    ['Trẻ chia sẻ cảm xúc về trường mầm non.', ['TX1.2', 'TX3.1', 'NN2.5']],
  ]),
  slot('w2', 'Thể dục sáng', {
    text: 'Tập theo nhạc bài “Trường chúng cháu là trường mầm non”: hô hấp – tay – bụng – chân – bật, mỗi động tác 2 x 4 nhịp.',
    codes: ['TC1.1'],
  }),
  slot('w3', 'Hoạt động học', [
    ['Thể dục: Đi trong đường hẹp theo hiệu lệnh. TC dân gian: Mèo đuổi chuột.', ['TC1.1', 'TC1.2', 'TC3.1']],
    ['Khám phá khoa học: Lớp học vui vẻ của bé.', ['NT1.3', 'NT2.1', 'NN2.2']],
    ['Văn học: Thơ “Bé tới trường”.', ['NN1.1', 'NN1.3', 'NN2.2', 'NN2.5']],
    ['Toán: Ôn nhận biết, phân biệt hình vuông, tròn, tam giác, chữ nhật quanh lớp.', ['NT4.2', 'NT5.1', 'NN2.2']],
    ['Tạo hình: Làm khung ảnh tình bạn từ bìa carton và hột hạt.', ['NgT3.2']],
  ]),
  slot('w4', 'Hoạt động ngoài trời', [
    ['Quan sát đồ chơi trong trường. TCVĐ: Thỏ nghe hát nhảy vào chuồng.', ['TC1.1', 'TC3.1', 'NT1.3']],
    ['Quan sát cây cối trong trường. TC dân gian: Lộn cầu vồng.', ['TC1.1', 'NT1.3']],
    ['Quan sát đồ chơi trong trường. TCVĐ: Gieo hạt nảy mầm.', ['TC1.1', 'NT2.1']],
    ['Quan sát và trao đổi về khu vực trẻ thích. TCVĐ: Mèo đuổi chuột.', ['TC1.1', 'NT1.3']],
    ['TCVĐ: Bịt mắt bắt dê. Chơi tự chọn: Ném vòng.', ['TC1.1', 'TX1.3']],
  ]),
  slot('w5', 'Hoạt động vui chơi trong lớp', [
    ['Góc phân vai: Cô giáo – học sinh. Góc xây dựng: Bé đến trường.', ['TX4.1', 'NN2.2']],
    ['Góc phân vai: Cô giáo – học sinh. Góc thiên nhiên: Chăm sóc cây con.', ['TX4.1', 'NN2.2']],
    ['Góc học tập: Ghép tranh các khu vực trong trường.', ['NT1.3', 'TX4.1']],
    ['Góc nghệ thuật: Hát các bài hát về trường.', ['TX4.1', 'NgT2.1']],
    ['Góc nghệ thuật: Hát các bài hát về trường. Góc xây dựng: Bé đến trường.', ['TX4.1', 'NgT2.1']],
  ]),
  slot('w6', 'Ăn – Ngủ – Vệ sinh', {
    text: 'Thực hành rửa tay đúng quy trình; ăn văn minh, ngồi đúng tư thế; tự lấy, cất đồ dùng cá nhân; ngủ đúng giờ.',
    codes: ['TC4.2', 'TC6.1', 'TX3.1'],
  }),
  slot('w7', 'Sinh hoạt chiều', [
    ['Ôn vận động: Đi trong đường hẹp. Lau dọn, sắp xếp đồ chơi.', ['TC1.2', 'TX3.1']],
    ['Ôn: Lớp học vui vẻ của bé. Cất đồ dùng đúng nơi quy định.', ['NT1.3', 'TX3.1']],
    ['Ôn thơ “Bé tới trường”.', ['NN1.1', 'TX3.1']],
    ['Ôn toán; dạy trẻ kỹ năng chào hỏi lễ phép.', ['NT5.1', 'TX3.1']],
    ['Ôn tạo hình: vẽ trường mầm non. Nêu gương cuối tuần.', ['TC1.2', 'TX3.1']],
  ]),
  slot('w8', 'Trả trẻ', { text: 'Trẻ chào cô, chào bạn; cô trao đổi với phụ huynh về tình hình của trẻ trong ngày.', codes: ['NN2.5'] }),
];

const daySlot = (id, name, duration, topic, codes, extra = {}) => ({
  id,
  name,
  duration,
  topic,
  codes,
  purpose: '',
  skills: '',
  qualities: ['Yêu thương', 'Tôn trọng', 'Trách nhiệm', 'Trung thực'],
  competencies: ['Giao tiếp', 'Hợp tác', 'Giải quyết vấn đề', 'Tự lực', 'Thích ứng'],
  prepTeacher: '',
  prepChild: '',
  steps: [],
  ...extra,
});

const DAY_1009_SLOTS = [
  daySlot('d1', 'Đón trẻ – Trò chuyện sáng', '', 'Trò chuyện “Bé đến trường”; tập thể dục sáng theo nhạc', ['TX1.2', 'TX3.1', 'NN2.5'], {
    purpose: 'Trẻ thực hiện nề nếp đến lớp; biết nội dung trò chuyện trong ngày.',
    skills: 'Chào hỏi, cất đồ cá nhân; nói câu đủ ý; tập đúng các động tác theo nhạc.',
    prepTeacher: 'Lớp sạch, tranh ảnh trường lớp; nhạc vui đến trường.',
    prepChild: 'Trang phục gọn gàng; đồ cá nhân có ký hiệu.',
    steps: [
      {
        id: 'd1s1',
        title: 'Đón trẻ – chơi',
        teacher: 'Cô đón trẻ thân thiện, nhắc trẻ chào cô, tự cất ba lô, dép đúng ký hiệu. Gợi hỏi: “Hôm nay con đến trường với ai?”',
        child: 'Trẻ chào hỏi, tự cất đồ, trò chuyện và chơi theo lựa chọn.',
      },
      {
        id: 'd1s2',
        title: 'Thể dục sáng',
        teacher: 'Khởi động đi – chạy nhẹ; tập hô hấp – tay – bụng – chân – bật, mỗi động tác 2 x 4 nhịp.',
        child: 'Trẻ tập các động tác cùng cô, giữ khoảng cách và thả lỏng cuối bài.',
      },
    ],
  }),
  daySlot(
    'd2',
    'Hoạt động học',
    '25–30 phút',
    'Toán: Ôn nhận biết, phân biệt hình vuông, hình tròn, hình tam giác, hình chữ nhật quanh lớp',
    ['NT4.2', 'NT5.1', 'NN2.2'],
    {
      purpose: 'Trẻ nhận biết và gọi đúng tên 4 hình; tìm được đồ vật có dạng các hình quanh lớp.',
      skills: 'Quan sát, so sánh, phân loại hình; diễn đạt kết quả bằng câu ngắn rõ ý.',
      prepTeacher: 'Bộ 4 hình cỡ lớn; thẻ hình; đồ vật trong lớp có dạng tương ứng; 4 “ngôi nhà hình”.',
      prepChild: 'Mỗi trẻ một rổ 4 hình; tâm thế thoải mái.',
      steps: [
        {
          id: 'd2s1',
          title: 'Gây hứng thú – Kết nối',
          teacher: 'Chơi “Chiếc túi kỳ lạ”: trẻ sờ, chọn hình. Hỏi: “Con đoán hình gì?”',
          child: 'Trẻ sờ, chọn hình, đoán và liên hệ đồ vật.',
        },
        {
          id: 'd2s2',
          title: 'Quan sát – Trải nghiệm',
          teacher: 'Cô yêu cầu trẻ giơ hình tròn, vuông, tam giác, chữ nhật; hỏi đặc điểm nổi bật.',
          child: 'Trẻ giơ đúng hình, gọi tên, trả lời về đặc điểm.',
        },
        {
          id: 'd2s3',
          title: 'Chia sẻ',
          teacher: 'Trẻ ghép thẻ hình với đồ vật: mặt đồng hồ, ô cửa, lá cờ…',
          child: 'Trẻ ghép hình với đồ vật, diễn đạt kết quả.',
        },
        {
          id: 'd2s4',
          title: 'Vận dụng – Luyện tập',
          teacher: 'Trò chơi “Về đúng nhà”: khi nhạc dừng, trẻ chạy về ngôi nhà cùng hình.',
          child: 'Trẻ chơi “Về đúng nhà”, phân loại thẻ theo nhóm.',
        },
        {
          id: 'd2s5',
          title: 'Khái quát – Đánh giá',
          teacher: 'Mời trẻ gọi tên 4 hình và nêu ví dụ; cô nhận xét, củng cố.',
          child: 'Trẻ gọi tên 4 hình, nêu ví dụ và tự kiểm tra kết quả.',
        },
      ],
    },
  ),
  daySlot(
    'd3',
    'Hoạt động ngoài trời',
    '40–45 phút',
    'Quan sát khu vực trẻ thích ở trường. TCVĐ: Mèo đuổi chuột. Chơi tự do',
    ['TC1.1', 'NT1.3'],
    {
      purpose: 'Trẻ quan sát, trao đổi về khu vực trẻ thích; biết cách chơi Mèo đuổi chuột và quy tắc an toàn.',
      skills: 'Quan sát, trao đổi, vận động theo hiệu lệnh.',
      prepTeacher: 'Sân sạch, khu vực quan sát an toàn; đồ chơi ngoài trời; nước uống.',
      steps: [
        {
          id: 'd3s1',
          title: 'Quan sát có mục đích',
          teacher: 'Gợi hỏi: “Con nhìn thấy gì?”, “Khu vực này dùng để làm gì?”',
          child: 'Trẻ quan sát, trả lời, trao đổi với bạn.',
        },
        {
          id: 'd3s2',
          title: 'Trò chơi vận động',
          teacher: 'Giới thiệu cách chơi, luật chơi Mèo đuổi chuột; tổ chức 2–3 lượt.',
          child: 'Trẻ chơi 2–3 lượt, chờ lượt và phối hợp.',
        },
      ],
    },
  ),
  daySlot(
    'd4',
    'Hoạt động vui chơi trong lớp',
    '35–40 phút',
    'Góc phân vai: Cô giáo – học sinh; Góc nghệ thuật: hát các bài về trường',
    ['TX4.1', 'NgT2.1'],
    {
      purpose: 'Trẻ biết nội dung các góc chơi; thỏa thuận vai và giao tiếp trong vai.',
      prepTeacher: 'Đồ chơi phân vai; khối xây dựng; nhạc cụ; giấy, bút màu.',
    },
  ),
  daySlot('d5', 'Ăn – Ngủ – Vệ sinh', '', 'Ăn văn minh: ngồi đúng tư thế, nhai kỹ', ['TC6.1'], {
    qualities: ['Trách nhiệm'],
    competencies: ['Tự lực'],
  }),
  daySlot('d6', 'Sinh hoạt chiều', '', 'Ôn toán; dạy trẻ kỹ năng chào hỏi lễ phép', ['NT5.1', 'TX3.1'], {
    qualities: ['Tôn trọng'],
    competencies: ['Giao tiếp'],
  }),
];

const hist = (...rows) => rows.map(([action, by, role, at, tone, note]) => ({ action, by, role, at, tone, ...(note ? { note } : {}) }));

const SEED_LESSONS = [
  {
    id: 'l-1',
    code: 'KHT-CHOI1-0907',
    type: 'week',
    classId: 'c-choi1',
    ageGroupId: 'ag-4',
    themeId: 't-1',
    weekIndex: 1,
    branch: 'Trường mầm non thân yêu',
    weekStart: '2026-09-07',
    weekEnd: '2026-09-11',
    date: null,
    slots: WEEK_1_SLOTS,
    dayNotes: { '2026-09-07': 'Trẻ hào hứng, 2 trẻ còn khóc khi bố mẹ về.', '2026-09-08': 'Cả lớp nhớ tên cô, tên bạn.' },
    weekReview: 'Tăng thời gian làm quen cho nhóm trẻ mới; tuần sau bổ sung trò chơi “Tìm bạn thân”.',
    status: 'APPROVED',
    createdBy: 'Lê Minh Anh',
    history: hist(
      ['Gửi tổ trưởng', 'Lê Minh Anh', 'Giáo viên', '2026-09-03 15:10', ''],
      ['Tổ trưởng duyệt, chuyển Phó HT', 'Trần Thu Hà', 'Tổ trưởng nhóm tuổi', '2026-09-04 09:00', 'ok'],
      ['Phó HT phê duyệt', 'Nguyễn Thị Lan', 'Phó hiệu trưởng', '2026-09-04 14:30', 'ok'],
    ),
  },
  {
    id: 'l-2',
    code: 'GAN-CHOI1-0910',
    type: 'day',
    classId: 'c-choi1',
    ageGroupId: 'ag-4',
    themeId: 't-1',
    weekIndex: 1,
    branch: 'Trường mầm non thân yêu',
    weekStart: '2026-09-07',
    weekEnd: '2026-09-11',
    date: '2026-09-10',
    slots: DAY_1009_SLOTS,
    dayReview: 'Trẻ hứng thú với trò chơi “Về đúng nhà”; 3 trẻ còn nhầm hình vuông và hình chữ nhật.',
    adjust: 'Ôn lại hình chữ nhật cho bé An, bé Minh vào giờ chơi chiều.',
    status: 'APPROVED',
    createdBy: 'Lê Minh Anh',
    history: hist(
      ['Gửi tổ trưởng', 'Lê Minh Anh', 'Giáo viên', '2026-09-08 16:00', ''],
      ['Tổ trưởng duyệt, chuyển Phó HT', 'Trần Thu Hà', 'Tổ trưởng nhóm tuổi', '2026-09-09 08:10', 'ok'],
      ['Phó HT phê duyệt', 'Nguyễn Thị Lan', 'Phó hiệu trưởng', '2026-09-09 10:20', 'ok'],
    ),
  },
  {
    id: 'l-3',
    code: 'KHT-CHOI1-1005',
    type: 'week',
    classId: 'c-choi1',
    ageGroupId: 'ag-4',
    themeId: 't-2',
    weekIndex: 2,
    branch: 'Cơ thể bé',
    weekStart: '2026-10-05',
    weekEnd: '2026-10-09',
    date: null,
    slots: [
      {
        id: 'x1',
        name: 'Hoạt động học',
        allWeek: false,
        all: { text: '', codes: [] },
        cells: {
          '2026-10-05': { text: 'Khám phá: Các bộ phận trên cơ thể bé.', codes: ['NT1.4'] },
          '2026-10-06': { text: 'Âm nhạc: Hát và vận động “Cái mũi”.', codes: ['NgT2.2'] },
        },
      },
      { id: 'x2', name: 'Thể dục sáng', allWeek: true, cells: {}, all: { text: 'Tập theo nhạc bài “Cái mũi”.', codes: ['TC2.1'] } },
    ],
    dayNotes: {},
    weekReview: '',
    status: 'PENDING_TL',
    createdBy: 'Lê Minh Anh',
    history: hist(['Gửi tổ trưởng', 'Lê Minh Anh', 'Giáo viên', '2026-10-02 16:45', '']),
  },
  {
    id: 'l-4',
    code: 'GAN-CHOI1-1001',
    type: 'day',
    classId: 'c-choi1',
    ageGroupId: 'ag-4',
    themeId: 't-2',
    weekIndex: 1,
    branch: 'Bé là ai',
    weekStart: '2026-09-28',
    weekEnd: '2026-10-02',
    date: '2026-10-01',
    slots: [
      daySlot('y1', 'Hoạt động học', '25–30 phút', 'Âm nhạc: Hát “Cái mũi”', ['NgT2.2'], {
        purpose: 'Trẻ hát đúng giai điệu, vận động minh họa theo bài hát.',
      }),
    ],
    dayReview: '',
    adjust: '',
    status: 'REJECTED',
    createdBy: 'Lê Minh Anh',
    history: hist(
      ['Gửi tổ trưởng', 'Lê Minh Anh', 'Giáo viên', '2026-09-29 14:00', ''],
      [
        'Tổ trưởng từ chối',
        'Trần Thu Hà',
        'Tổ trưởng nhóm tuổi',
        '2026-09-30 08:20',
        'err',
        'Bổ sung phần chuẩn bị đồ dùng và các bước tổ chức trò chơi cuối giờ.',
      ],
    ),
  },
  {
    id: 'l-5',
    code: 'KHT-CHOI2-1005',
    type: 'week',
    classId: 'c-choi2',
    ageGroupId: 'ag-4',
    themeId: 't-2',
    weekIndex: 2,
    branch: 'Cơ thể bé',
    weekStart: '2026-10-05',
    weekEnd: '2026-10-09',
    date: null,
    slots: [
      {
        id: 'z1',
        name: 'Hoạt động học',
        allWeek: false,
        all: { text: '', codes: [] },
        cells: { '2026-10-05': { text: 'Bé tập rửa tay 6 bước.', codes: ['TC6.2'] } },
      },
    ],
    dayNotes: {},
    weekReview: '',
    status: 'PENDING_VP',
    createdBy: 'Trần Thu Hà',
    history: hist(
      ['Gửi tổ trưởng', 'Trần Thu Hà', 'Giáo viên', '2026-10-02 10:10', ''],
      ['Tổ trưởng duyệt, chuyển Phó HT', 'Trần Thu Hà', 'Tổ trưởng nhóm tuổi', '2026-10-02 10:40', 'ok'],
    ),
  },
  {
    id: 'l-6',
    code: 'GAN-CHOI1-1007',
    type: 'day',
    classId: 'c-choi1',
    ageGroupId: 'ag-4',
    themeId: 't-2',
    weekIndex: 2,
    branch: 'Cơ thể bé',
    weekStart: '2026-10-05',
    weekEnd: '2026-10-09',
    date: '2026-10-07',
    slots: [daySlot('v1', 'Hoạt động học', '25–30 phút', 'Văn học: Truyện “Gấu con bị đau răng”', ['NN2.3'])],
    dayReview: '',
    adjust: '',
    status: 'DRAFT',
    createdBy: 'Lê Minh Anh',
    history: [],
  },
];

export const buildSeedEducationPlans = () => ({
  eduGoals: SEED_GOALS,
  eduThemes: SEED_THEMES,
  eduLessons: SEED_LESSONS,
});
