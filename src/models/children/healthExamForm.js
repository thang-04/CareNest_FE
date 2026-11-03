/**
 * Phiếu kiểm tra sức khỏe trẻ theo Phụ lục II, Thông tư 33/2026/TT-BYT (user chốt 2026-10-17, PROPOSED — chờ BE).
 * Một cấu hình dùng chung cho form nhập, trang xem phiếu, khối "Điểm cần bác sĩ xem lại" và lịch sử sửa.
 * Giáo viên nhập theo lời bác sĩ; hệ thống chỉ gợi ý, không tự kết luận. Mức theo dõi theo kết luận bác sĩ (D9).
 *
 * Số đo chiều cao, cân nặng, vòng đầu nằm ở measurement (dùng chung với Sổ sức khỏe, xu hướng); phần còn lại ở measurement.exam.
 *
 * @typedef {Object} HealthExam
 * @property {number} step                       bước xa nhất đã tới (0–4), để mở lại phiếu nháp đúng chỗ
 * @property {ExamAdmin} admin
 * @property {{ self: YesNo|'', selfText: string, family: YesNo|'', familyText: string, tbContact: YesNo|'', tbContactDate: string }} history
 * @property {{ temperatureC: string|number, temperatureStatus: string, pulse: string|number, pulseStatus: string,
 *   respiratoryRate: string|number, respiratoryStatus: string }} vitals
 * @property {{ lengthForAgeSd: string|number, weightForAgeSd: string|number, headStatus: string,
 *   armCircumferenceMm: string|number, statuses: string[] }} nutrition
 * @property {{ mental: YesNo|'', motor: YesNo|'', autismRisk: YesNo|'' }} development
 * @property {{ bcg: YesNo|'', hepB1: YesNo|'', fullSchedule: YesNo|'' }} immunization
 * @property {Object<string, string>} clinical   key theo CLINICAL_GROUPS, kèm behaviorNote
 * @property {ExamConclusion} conclusion
 *
 * @typedef {Object} ExamAdmin
 * @property {string} childIdNumber              số CC/CCCD/hộ chiếu/mã định danh của trẻ (user chốt có lưu 2026-10-17)
 * @property {YesNo|''} premature
 * @property {string|number} gestationWeeks
 * @property {string} ethnicity
 * @property {string} beneficiary                 "Đối tượng"
 * @property {string} paymentSource
 * @property {string} bloodType
 * @property {{ province: string, ward: string, street: string }} address
 * @property {YesNo|''} hasCompanion
 * @property {{ guardianIndex: number|null, fullName: string, relation: string, phone: string, idNumber: string }} companion
 *
 * @typedef {Object} ExamConclusion
 * @property {boolean} normal
 * @property {boolean} tbRisk
 * @property {boolean} healthIssue
 * @property {'NEW'|'KNOWN'|''} issueKind        mẫu thường: vấn đề mới hay đã biết (khi có vấn đề, không chuyển khám)
 * @property {'NO_NEW_FINDING'|'ADVICE'|'NEW_FINDING'|''} followUpFinding  mẫu FOLLOW_UP (trẻ đang có phiếu theo dõi)
 * @property {string} issueText
 * @property {'NONE'|'ADVICE'|'REFERRAL'|''} action
 * @property {string} adviceText
 * @property {string} specialty
 * @property {string} doctorName
 * @property {string} parentOpinion              ý kiến phụ huynh tại buổi khám: có người đi cùng, mức Cần theo dõi sát (2026-10-23)
 *
 * @typedef {'YES'|'NO'} YesNo
 */

export const EXAM_STATUS = { DRAFT: 'DRAFT', CONCLUDED: 'CONCLUDED' };

export const EXAM_STATUS_LABELS = { DRAFT: 'Đang khám', CONCLUDED: 'Đã có kết luận' };

export const EXAM_STEPS = [
  { key: 'admin', label: 'Hành chính, tiền sử', title: 'I. Thông tin hành chính và tiền sử' },
  { key: 'measure', label: 'Sinh tồn, dinh dưỡng', title: 'II–III. Dấu hiệu sinh tồn và dinh dưỡng' },
  { key: 'development', label: 'Phát triển, tiêm chủng', title: 'IV–V. Phát triển tinh thần – vận động và tiêm chủng' },
  { key: 'clinical', label: 'Khám lâm sàng', title: 'VI. Khám lâm sàng' },
  { key: 'conclusion', label: 'Kết luận', title: 'Kết luận và tư vấn' },
];

export const YES_NO = { YES: 'YES', NO: 'NO' };

const opt = (value, label, abnormal = false) => ({ value, label, abnormal });
const NO_YES = [opt('NO', 'Không'), opt('YES', 'Có', true)];
// Mẫu in "Có" trước ở 2 câu tâm lý, hành vi.
const YES_FIRST = [opt('YES', 'Có', true), opt('NO', 'Không')];
const NORMAL_OR = (label = 'Không bình thường') => [opt('NORMAL', 'Bình thường'), opt('ABNORMAL', label, true)];
// Phần IV, V: "Có" là đạt (phát triển bình thường, đã tiêm), "Không" là điểm cần xem lại.
const HAS_NO = [opt('YES', 'Có'), opt('NO', 'Không', true)];

// Sinh non: "Có" không phải bất thường của buổi khám, chỉ là thông tin hành chính.
export const PREMATURE_OPTIONS = [opt('NO', 'Không'), opt('YES', 'Có')];

export const COMPANION_OPTIONS = [opt('YES', 'Có người đi cùng'), opt('NO', 'Không có người đi cùng')];

export const COMPANION_RELATIONS = ['Cha', 'Mẹ', 'Ông/bà', 'Anh/chị', 'Họ hàng', 'Khác'];

// Quan hệ trong hồ sơ trẻ ⇒ lựa chọn của mẫu.
export const GUARDIAN_TO_COMPANION_RELATION = { Bố: 'Cha', Mẹ: 'Mẹ', Ông: 'Ông/bà', Bà: 'Ông/bà', 'Anh/chị': 'Anh/chị' };

export const HISTORY_ITEMS = [
  { key: 'self', label: 'Tiền sử bản thân', options: NO_YES, textKey: 'selfText', textLabel: 'Tên bệnh của trẻ' },
  { key: 'family', label: 'Tiền sử gia đình', options: NO_YES, textKey: 'familyText', textLabel: 'Tên bệnh trong gia đình' },
  // "Có" thì kèm ngày tiếp xúc gần nhất, điền sẵn từ khai báo (user chốt 2026-10-21).
  {
    key: 'tbContact',
    label: 'Tiền sử tiếp xúc với người bệnh lao',
    options: NO_YES,
    dateKey: 'tbContactDate',
    dateLabel: 'Ngày tiếp xúc gần nhất',
  },
];

export const VITAL_ITEMS = [
  {
    key: 'temperatureC',
    statusKey: 'temperatureStatus',
    label: 'Nhiệt độ (°C)',
    unit: '°C',
    min: 34,
    max: 42,
    step: '0.1',
    options: [opt('NORMAL', 'Bình thường'), opt('FEVER', 'Sốt', true), opt('HYPOTHERMIA', 'Hạ thân nhiệt', true)],
  },
  {
    key: 'pulse',
    statusKey: 'pulseStatus',
    label: 'Mạch (lần/phút)',
    unit: 'lần/phút',
    min: 40,
    max: 220,
    step: '1',
    options: [opt('NORMAL', 'Bình thường'), opt('FAST', 'Nhanh', true)],
  },
  {
    key: 'respiratoryRate',
    statusKey: 'respiratoryStatus',
    label: 'Nhịp thở (lần/phút)',
    unit: 'lần/phút',
    min: 10,
    max: 90,
    step: '1',
    options: [opt('NORMAL', 'Bình thường'), opt('FAST', 'Thở nhanh', true), opt('SLOW', 'Thở chậm', true)],
  },
];

export const HEAD_STATUS_OPTIONS = [opt('NORMAL', 'Bình thường'), opt('LARGE', 'Đầu to', true), opt('SMALL', 'Đầu nhỏ', true)];

export const NUTRITION_STATUS = { NORMAL: 'NORMAL' };

// Lựa chọn của bác sĩ theo mẫu Bộ Y tế; hệ thống không tự gắn các nhãn này (user chốt 2026-10-17).
export const NUTRITION_STATUS_OPTIONS = [
  opt('NORMAL', 'Bình thường'),
  opt('NUTRITIONAL_EDEMA', 'Phù dinh dưỡng', true),
  opt('ANEMIA_SIGNS', 'Dấu hiệu thiếu máu', true),
  opt('RICKETS_SIGNS', 'Dấu hiệu còi xương', true),
  opt('MALNUTRITION', 'Suy dinh dưỡng', true),
  opt('OVERWEIGHT', 'Thừa cân/béo phì', true),
];

export const DEVELOPMENT_ITEMS = [
  { key: 'mental', label: 'Phát triển tinh thần bình thường của trẻ theo độ tuổi', options: HAS_NO },
  { key: 'motor', label: 'Phát triển vận động bình thường của trẻ theo độ tuổi', options: HAS_NO },
  { key: 'autismRisk', label: 'Trẻ có nguy cơ tự kỷ (với trẻ từ 16–30 tháng tuổi)', options: NO_YES, ageMonths: [16, 30] },
];

export const IMMUNIZATION_ITEMS = [
  { key: 'bcg', label: 'Lao (sơ sinh)', options: HAS_NO },
  { key: 'hepB1', label: 'Viêm gan B mũi 1 (sơ sinh)', options: HAS_NO },
  { key: 'fullSchedule', label: 'Tiêm chủng đầy đủ các loại vắc xin theo độ tuổi', options: HAS_NO },
];

export const CLINICAL_GROUPS = [
  {
    key: 'general',
    title: '1. Toàn trạng',
    items: [
      {
        key: 'skinColor',
        label: 'Màu sắc da',
        options: [
          opt('PINK', 'Hồng hào'),
          opt('PALE', 'Nhợt', true),
          opt('CYANOTIC', 'Tím', true),
          opt('YELLOW', 'Vàng', true),
          opt('DARK', 'Sạm da', true),
        ],
      },
      {
        key: 'palms',
        label: 'Lòng bàn tay',
        options: [opt('NORMAL', 'Bình thường (không nhợt)'), opt('PALE', 'Không bình thường (nhợt)', true)],
      },
    ],
  },
  {
    key: 'headNeck',
    title: '2.1. Đầu – cổ',
    items: [
      { key: 'headShape', label: 'Kích thước và hình dạng đầu', options: NORMAL_OR() },
      { key: 'neckMotion', label: 'Vận động cổ', options: [opt('NORMAL', 'Bình thường'), opt('LIMITED', 'Giới hạn', true)] },
      { key: 'neckMass', label: 'Khối bất thường', options: NO_YES },
    ],
  },
  {
    key: 'eyes',
    title: '2.2. Khám mắt',
    items: [
      { key: 'eyePosition', label: 'Vị trí 2 mắt', options: [opt('NORMAL', 'Bình thường'), opt('WIDE', '2 mắt xa nhau', true)] },
      {
        key: 'eyelids',
        label: 'Mí mắt và kết mạc',
        options: [opt('NORMAL', 'Bình thường'), opt('SWOLLEN', 'Sưng/đỏ', true), opt('DISCHARGE', 'Chảy ghèn/mủ', true)],
      },
      { key: 'strabismus', label: 'Lác mắt', options: NO_YES },
    ],
  },
  {
    key: 'ears',
    title: '2.3. Khám tai',
    items: [
      { key: 'hearing', label: 'Đáp ứng với âm thanh', options: NORMAL_OR() },
      { key: 'earLump', label: 'Có khối sưng sau tai', options: NO_YES },
      { key: 'earDischarge', label: 'Dấu hiệu chảy mủ, nước tai', options: NO_YES },
    ],
  },
  {
    key: 'noseThroat',
    title: '2.4. Khám mũi – họng',
    items: [
      {
        key: 'noseShape',
        label: 'Hình dạng mũi',
        options: [opt('NORMAL', 'Bình thường'), opt('BROAD', 'Mũi to, dày', true), opt('APLASIA', 'Bất sản xương mũi', true)],
      },
      { key: 'runnyNose', label: 'Chảy nước mũi', options: NO_YES },
      { key: 'nasalCongestion', label: 'Nghẹt mũi', options: NO_YES },
    ],
  },
  {
    key: 'mouth',
    title: '2.5. Khám miệng, răng',
    items: [
      { key: 'mouthShape', label: 'Hình dạng miệng', options: [opt('NORMAL', 'Bình thường'), opt('CLEFT', 'Sứt môi, chẻ vòm', true)] },
      { key: 'tongueShape', label: 'Hình dạng lưỡi', options: [opt('NORMAL', 'Bình thường'), opt('LARGE', 'Lưỡi to bè', true)] },
      { key: 'tongueTie', label: 'Dính thắng lưỡi', options: NO_YES },
      { key: 'smallChin', label: 'Cằm nhỏ, tụt về sau', options: NO_YES },
      { key: 'dentalIssue', label: 'Vết sâu, mảng bám, lỗ trên răng', options: NO_YES },
    ],
  },
  {
    key: 'neuro',
    title: '3. Cơ xương và thần kinh',
    items: [
      { key: 'asymmetricMotion', label: 'Vận động không đối xứng', options: NO_YES },
      { key: 'spine', label: 'Kiểm tra lưng, cột sống', options: NORMAL_OR() },
      { key: 'gait', label: 'Quan sát dáng đi', options: NORMAL_OR() },
      { key: 'prolongedSadness', label: 'Có biểu hiện buồn bã, lo âu, mất ngủ kéo dài không', options: YES_FIRST, normal: 'NO' },
      { key: 'selfHarmRisk', label: 'Có hành vi bất thường hoặc nguy cơ tự gây hại không', options: YES_FIRST, normal: 'NO' },
    ],
  },
];

export const CLINICAL_ITEMS = CLINICAL_GROUPS.flatMap((g) => g.items);

// "Nếu có đề nghị ghi rõ" của mẫu: bắt buộc khi 1 trong 2 câu tâm lý, hành vi là "Có".
export const BEHAVIOR_NOTE_TRIGGERS = ['prolongedSadness', 'selfHarmRisk'];

export const CONCLUSION_ACTION = { NONE: 'NONE', ADVICE: 'ADVICE', REFERRAL: 'REFERRAL' };

export const CONCLUSION_ACTION_LABELS = {
  NONE: 'Không cần tư vấn hay chuyển khám',
  ADVICE: 'Tư vấn',
  REFERRAL: 'Chuyển khám chuyên khoa',
};

export const CONCLUSION_FLAGS = [
  { key: 'normal', label: 'Bình thường' },
  { key: 'tbRisk', label: 'Có nguy cơ mắc lao (tiền sử tiếp xúc)' },
  { key: 'healthIssue', label: 'Có vấn đề về sức khỏe' },
];

// "Có vấn đề" không chuyển khám: "Cần theo dõi" chỉ cho vấn đề có thể chuyển biến (user chốt 2026-10-21).
export const ISSUE_KIND = { NEW: 'NEW', KNOWN: 'KNOWN' };

export const ISSUE_KIND_LABELS = {
  NEW: 'Vấn đề mới hoặc có thay đổi',
  KNOWN: 'Vấn đề đã biết, không thay đổi so với trước',
};

/** Mẫu kết luận BE chọn: FOLLOW_UP khi trẻ có phiếu theo dõi đang mở do lần khám khác mở (user chốt 2026-10-21). */
export const CONCLUSION_MODE = { STANDARD: 'STANDARD', FOLLOW_UP: 'FOLLOW_UP' };

// Mẫu FOLLOW_UP: một câu so với vấn đề đang theo dõi thay cho 2 nhóm Kết luận, Hướng xử lý; lưu không đóng phiếu.
export const FOLLOW_UP_FINDING = { NO_NEW_FINDING: 'NO_NEW_FINDING', ADVICE: 'ADVICE', NEW_FINDING: 'NEW_FINDING' };

export const FOLLOW_UP_FINDING_LABELS = {
  NO_NEW_FINDING: 'Chưa ghi nhận thêm bất thường',
  ADVICE: 'Tư vấn',
  NEW_FINDING: 'Có thêm bất thường mới',
};

export const FOLLOW_UP_FINDING_HINTS = {
  NO_NEW_FINDING: 'Phiếu theo dõi giữ nguyên.',
  ADVICE: 'Có vấn đề nhỏ mới, bác sĩ chỉ tư vấn. Phiếu theo dõi giữ nguyên.',
  NEW_FINDING: 'Phiếu theo dõi sang vòng mới: trao đổi lại với phụ huynh.',
};

/** Câu kết luận để hiển thị; mẫu FOLLOW_UP hiện lựa chọn so với vấn đề đang theo dõi. */
export const conclusionLabelOf = (c) => {
  if (!c) return '';
  if (c.followUpFinding)
    return [FOLLOW_UP_FINDING_LABELS[c.followUpFinding], c.tbRisk ? CONCLUSION_FLAGS.find((f) => f.key === 'tbRisk').label : null]
      .filter(Boolean)
      .join(', ');
  return CONCLUSION_FLAGS.filter((f) => c[f.key])
    .map((f) => f.label)
    .join(', ');
};

/** Hướng xử lý để hiển thị; mẫu FOLLOW_UP không có nhóm này, chỉ có chuyên khoa đề nghị khi có bất thường mới. */
export const conclusionActionLabelOf = (c) => {
  if (!c) return '';
  if (c.followUpFinding) return c.specialty ? `Đề nghị khám chuyên khoa: ${c.specialty}` : '';
  const label = CONCLUSION_ACTION_LABELS[c.action] || '';
  return c.action === CONCLUSION_ACTION.REFERRAL && c.specialty ? `${label}: ${c.specialty}` : label;
};

/** Nhóm kết luận BE trả cho thống kê đợt; nguy cơ lao đứng trước chuyển khám. */
export const CONCLUSION_CATEGORY = {
  NORMAL: 'NORMAL',
  ISSUE: 'ISSUE',
  REFERRAL: 'REFERRAL',
  TB_RISK: 'TB_RISK',
  FOLLOWING_NO_NEW: 'FOLLOWING_NO_NEW',
  FOLLOWING_NEW: 'FOLLOWING_NEW',
};

export const CONCLUSION_CATEGORY_LABELS = {
  NORMAL: 'Bình thường',
  ISSUE: 'Có vấn đề, tư vấn',
  REFERRAL: 'Chuyển khám chuyên khoa',
  TB_RISK: 'Nguy cơ lao',
  FOLLOWING_NO_NEW: 'Đang theo dõi, chưa ghi nhận thêm',
  FOLLOWING_NEW: 'Đang theo dõi, có bất thường mới',
};

export const EXAM_FIELD_LIMITS = { short: 100, text: 300, note: 500, idNumber: 20 };

const optionsOf = (items) => Object.fromEntries(items.map((i) => [i.key, i.options[0].value]));

/** Phiếu trống: phần VI chọn sẵn "Bình thường"/"Không" (D5); các phần cần hỏi hoặc đo để trống. */
export const buildEmptyExam = () => ({
  step: 0,
  admin: {
    childIdNumber: '',
    premature: '',
    gestationWeeks: '',
    ethnicity: '',
    beneficiary: '',
    paymentSource: '',
    bloodType: '',
    address: { province: '', ward: '', street: '' },
    hasCompanion: '',
    companion: { guardianIndex: null, fullName: '', relation: '', phone: '', idNumber: '' },
  },
  history: { self: '', selfText: '', family: '', familyText: '', tbContact: '', tbContactDate: '' },
  vitals: { temperatureC: '', temperatureStatus: '', pulse: '', pulseStatus: '', respiratoryRate: '', respiratoryStatus: '' },
  nutrition: { lengthForAgeSd: '', weightForAgeSd: '', headStatus: '', armCircumferenceMm: '', statuses: [] },
  development: { mental: '', motor: '', autismRisk: '' },
  immunization: { bcg: '', hepB1: '', fullSchedule: '' },
  clinical: {
    ...optionsOf(CLINICAL_ITEMS),
    ...Object.fromEntries(CLINICAL_ITEMS.filter((i) => i.normal).map((i) => [i.key, i.normal])),
    behaviorNote: '',
  },
  conclusion: {
    normal: false,
    tbRisk: false,
    healthIssue: false,
    issueKind: '',
    followUpFinding: '',
    issueText: '',
    action: '',
    adviceText: '',
    specialty: '',
    doctorName: '',
    parentOpinion: '',
  },
});

/** Bước chứa một ô (theo khóa lỗi BE trả), để form mở đúng bước có lỗi. */
export const stepOfField = (key) => {
  if (/^exam\.(admin|history)\b/.test(key)) return 0;
  if (/^(date|heightCm|weightKg|headCircumferenceCm)$/.test(key) || /^exam\.(vitals|nutrition)\b/.test(key)) return 1;
  if (/^exam\.(development|immunization)\b/.test(key)) return 2;
  if (/^exam\.clinical\b/.test(key)) return 3;
  return 4;
};

export const labelOf = (options, value) => options.find((o) => o.value === value)?.label || '';
