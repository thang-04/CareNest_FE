/*
 * Đợt khám sức khỏe demo cho 2 điểm trường (dữ liệu giả). Kết quả khám nằm ở db.healthMeasurements (childrenSeed),
 * nối với đợt qua campaignId. Đợt đang diễn ra / sắp diễn ra tính theo ngày hôm nay để demo luôn dùng được.
 */
import { todayInput } from '@/utils/format';

const PRINCIPAL_ID = 'u_hung';
const EXAMINER = 'Trạm Y tế phường – bác sĩ khám định kỳ';

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Các đợt đã đóng: ngày khám trùng ngày đo trong childrenSeed. */
const PAST = [
  {
    date: '2026-03-16',
    endDate: '2026-03-20',
    name: 'Khám sức khỏe học kỳ II năm học 2025–2026',
    examiner: EXAMINER,
    note: 'Lần đầu đo vòng đầu và đánh giá vận động theo mẫu mới.',
    closedOn: '2026-03-23',
  },
  {
    date: '2026-06-15',
    endDate: '2026-06-19',
    name: 'Cân đo, khám sức khỏe cuối năm học 2025–2026',
    examiner: 'Trung tâm Y tế quận – đội khám lưu động',
    note: 'Khám cuối năm học, gửi kết quả cho phụ huynh trước kỳ nghỉ hè.',
    closedOn: '2026-06-22',
  },
  {
    date: '2026-09-15',
    endDate: '2026-09-18',
    name: 'Khám sức khỏe đầu năm học 2026–2027',
    examiner: EXAMINER,
    note: 'Khám đầu năm học cho toàn bộ trẻ đang học.',
    closedOn: '2026-09-21',
  },
];

// Đợt tháng 3 ở điểm trường c1 từng được mở lại để bổ sung kết quả (minh họa lịch sử đợt).
const REOPENED = { hc_c1_2603: { reopenedOn: '2026-03-24', reason: 'Bổ sung kết quả cho trẻ khám bù.', closedOn: '2026-03-27' } };

export const SEED_CAMPAIGN_DATES = PAST.map((p) => p.date);

export const seedCampaignId = (campusId, date) => `hc_${campusId}_${date.slice(2, 4)}${date.slice(5, 7)}`;

/** Đợt đang diễn ra ở điểm trường c1 (giáo viên Lớp Mầm 1 đã nhập một phần). */
export const OPEN_CAMPAIGN = { id: 'hc_c1_open', campusId: 'c1' };

/** Đợt đã đóng đầu tháng 10 ở điểm trường c2, nhập theo phiếu Phụ lục II (có phiếu chưa kết luận, phiếu theo dõi quá hạn). */
export const C2_OCT_CAMPAIGN = {
  id: 'hc_c2_2610',
  campusId: 'c2',
  date: '2026-10-06',
  startDate: '2026-10-05',
  endDate: '2026-10-07',
  closedOn: '2026-10-08',
};

export const openCampaignDates = (today = todayInput()) => ({
  startDate: addDays(today, -2),
  endDate: addDays(today, 5),
  entryDate: addDays(today, -1),
});

const monthName = (iso) => `tháng ${Number(iso.slice(5, 7))}/${iso.slice(0, 4)}`;

const event = (on, action, extra = {}) => ({
  at: `${on}T${action === 'CREATED' ? '02' : '09'}:00:00.000Z`,
  userId: PRINCIPAL_ID,
  action,
  ...extra,
});

const pastHistory = (id, createdOn, closedOn) => {
  const r = REOPENED[id];
  return [
    event(createdOn, 'CREATED'),
    event(closedOn, 'CLOSED'),
    ...(r ? [event(r.reopenedOn, 'REOPENED', { reason: r.reason }), event(r.closedOn, 'CLOSED')] : []),
  ];
};

/** Kỳ cân đo đang diễn ra ở c2 (user chốt 2026-10-31): giáo viên nhập số đo cho lớp mình, chưa ai nhập. */
const C2_ROUND_FIELDS = {
  id: 'hc_c2_next',
  kind: 'MEASUREMENT',
  campusId: 'c2',
  examiner: '',
  note: 'Giáo viên cân đo tại lớp, nhập số đo cho từng trẻ.',
};

/**
 * measurements/children: kết quả và trẻ seed — trẻ seed đang học chưa có kết quả trong đợt đã đóng là "Vắng khám".
 */
export const buildSeedHealthChecks = ({ today = todayInput(), measurements = [], children = [] } = {}) => {
  const open = openCampaignDates(today);
  const base = { kind: 'EXAM', examiner: EXAMINER, note: '', createdBy: PRINCIPAL_ID, cancelledAt: null, absentChildIds: [] };
  const seedChildren = children.filter((c) => /^ch_\d+$/.test(c.id) && c.status === 'ACTIVE');
  const past = ['c1', 'c2'].flatMap((campusId) =>
    PAST.map((p) => {
      const id = seedCampaignId(campusId, p.date);
      const closedOn = REOPENED[id]?.closedOn || p.closedOn;
      return {
        ...base,
        id,
        name: p.name,
        campusId,
        startDate: p.date,
        endDate: p.endDate,
        examiner: p.examiner,
        note: p.note,
        createdAt: `${addDays(p.date, -7)}T02:00:00.000Z`,
        closedAt: `${closedOn}T09:00:00.000Z`,
        closedBy: PRINCIPAL_ID,
        absentChildIds: seedChildren
          .filter((c) => c.campusId === campusId && !measurements.some((m) => m.childId === c.id && m.campaignId === id))
          .map((c) => c.id),
        history: pastHistory(id, addDays(p.date, -7), p.closedOn),
      };
    }),
  );
  const oct = C2_OCT_CAMPAIGN;
  const c2Oct = {
    ...base,
    id: oct.id,
    name: 'Khám bổ sung đầu tháng 10/2026 (phiếu Phụ lục II)',
    campusId: oct.campusId,
    startDate: oct.startDate,
    endDate: oct.endDate,
    examiner: 'Trạm Y tế phường – BS. Đặng Quốc Việt',
    note: 'Khám bổ sung cho trẻ vắng đợt tháng 9 và trẻ phụ huynh đề nghị khám lại.',
    createdAt: `${addDays(oct.startDate, -5)}T02:00:00.000Z`,
    closedAt: `${oct.closedOn}T09:00:00.000Z`,
    closedBy: PRINCIPAL_ID,
    absentChildIds: seedChildren
      .filter((c) => c.campusId === oct.campusId && !measurements.some((m) => m.childId === c.id && m.campaignId === oct.id))
      .map((c) => c.id),
    history: [event(addDays(oct.startDate, -5), 'CREATED'), event(oct.closedOn, 'CLOSED')],
  };
  return [
    ...past,
    c2Oct,
    {
      ...base,
      id: OPEN_CAMPAIGN.id,
      name: `Khám sức khỏe định kỳ ${monthName(open.startDate)}`,
      campusId: OPEN_CAMPAIGN.campusId,
      startDate: open.startDate,
      endDate: open.endDate,
      note: 'Giáo viên có mặt cùng bác sĩ để ghi kết quả từng trẻ.',
      createdAt: `${addDays(open.startDate, -5)}T02:00:00.000Z`,
      closedAt: null,
      closedBy: null,
      history: [event(addDays(open.startDate, -5), 'CREATED')],
    },
    {
      ...base,
      ...C2_ROUND_FIELDS,
      name: `Cân đo định kỳ ${monthName(open.startDate)}`,
      startDate: open.startDate,
      endDate: open.endDate,
      createdAt: `${addDays(open.startDate, -3)}T01:00:00.000Z`,
      closedAt: null,
      closedBy: null,
      history: [event(addDays(open.startDate, -3), 'CREATED')],
    },
  ];
};

/**
 * Phiếu theo dõi demo (đủ các trạng thái). openedOn: ngày khám mở phiếu (kết quả mẫu cũ). fromCampaign: phiếu mở từ phiếu
 * khám Phụ lục II của đợt đó; có người đi cùng thì ghi trao đổi tại buổi khám như hệ thống (user chốt 2026-10-17).
 * Nội dung chỉ ghi việc trao đổi và lời bác sĩ phụ huynh báo lại, không có chẩn đoán.
 * Giờ của sự kiện cố định để bản nâng cấp nhận ra phiếu seed người dùng chưa thao tác.
 */
// Ảnh giấy kết quả mẫu (vẽ bằng SVG, không phải giấy thật).
const SAMPLE_RESULT_IMAGE = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="whitesmoke" stroke="silver"/>' +
    '<text x="160" y="96" font-size="16" text-anchor="middle" fill="dimgray">Ảnh giấy kết quả (mẫu)</text>' +
    '<text x="160" y="122" font-size="12" text-anchor="middle" fill="gray">Dữ liệu demo, không phải giấy thật</text></svg>',
)}`;

const SEED_FOLLOW_UPS = [
  {
    // Đã đóng: có trao đổi và kết quả chuyên khoa.
    childId: 'ch_014',
    campusId: 'c1',
    teacherId: 'u_mai',
    openedOn: '2026-03-16',
    contacts: [{ on: '2026-03-19', note: 'Trao đổi trực tiếp với mẹ của trẻ, đề nghị đưa trẻ đi khám chuyên khoa nhi.' }],
    externalResults: [
      {
        on: '2026-04-08',
        facility: 'Nhi khoa – Bệnh viện Trẻ em Hải Phòng',
        note: 'Phụ huynh báo bác sĩ chuyên khoa hẹn khám lại khi có thay đổi.',
      },
    ],
    closed: {
      on: '2026-05-05',
      reason: 'Phụ huynh đã cho trẻ khám chuyên khoa; nhà trường theo dõi tiếp ở các đợt khám sau.',
      outcome: 'DOCTOR_NORMAL',
    },
  },
  {
    // Đã đóng: trao đổi 2 lần, không có kết quả chuyên khoa.
    childId: 'ch_025',
    campusId: 'c2',
    teacherId: 'u_tuan',
    openedOn: '2026-06-15',
    contacts: [
      { on: '2026-06-17', note: 'Đã gọi điện cho bố của trẻ, gửi kết quả khám và đề nghị khám chuyên khoa trong kỳ nghỉ hè.' },
      { on: '2026-07-10', note: 'Nhắc lại phụ huynh lịch khám chuyên khoa; phụ huynh hẹn đưa trẻ đi khám trong tháng 8.' },
    ],
    closed: {
      on: '2026-08-20',
      reason: 'Phụ huynh báo đã đưa trẻ đi khám nhưng không gửi kết quả; theo dõi tiếp ở đợt khám đầu năm học.',
      outcome: 'NO_SPECIALIST_RESULT',
    },
  },
  {
    // Đã trao đổi về kết quả tháng 9; phiếu khám mới (không có người đi cùng) mở vòng mới, chờ trao đổi lại.
    childId: 'ch_003',
    campusId: 'c1',
    teacherId: 'u_an',
    contacts: [{ on: '2026-09-22', note: 'Đã gọi điện cho mẹ của trẻ, đề nghị đưa trẻ đi khám chuyên khoa nhi.' }],
  },
  // Chờ trao đổi từ tháng 9, quá hạn; lớp Chồi 1 chưa khám đợt này (khám trẻ có phiếu đang mở).
  { childId: 'ch_011', campusId: 'c1', teacherId: 'u_minhanh' },
  {
    // Có kết quả chuyên khoa (chuyên khoa, ảnh, hẹn khám lại đã tới ngày ⇒ nhắc); phiếu khám mới có người đi cùng mở vòng mới.
    childId: 'ch_019',
    campusId: 'c1',
    teacherId: 'u_hoa',
    contacts: [{ on: '2026-09-19', note: 'Trao đổi trực tiếp với bố của trẻ khi đón trẻ, gửi kèm kết quả khám của đợt.' }],
    externalResults: [
      {
        on: '2026-10-02',
        facility: 'Nhi khoa – khám phát triển, Bệnh viện Nhi Hải Phòng',
        note: 'Phụ huynh báo bác sĩ chuyên khoa hẹn khám lại sau 2 tuần.',
        nextVisitOn: '2026-10-16',
        images: [SAMPLE_RESULT_IMAGE],
      },
    ],
  },
  // Đã trao đổi ngày 16/9, chưa có kết quả chuyên khoa sau 30 ngày ⇒ hệ thống nhắc giáo viên.
  {
    childId: 'ch_027',
    campusId: 'c2',
    teacherId: 'u_tuan',
    contacts: [{ on: '2026-09-16', note: 'Đã gọi điện cho bố của trẻ, đề nghị đưa trẻ đi khám chuyên khoa nhi.' }],
  },
  {
    // Đóng với kết quả "chuyên khoa xác định có vấn đề" ⇒ danh sách trẻ hiện "Vấn đề đã biết, ổn định".
    childId: 'ch_031',
    campusId: 'c2',
    teacherId: 'u_ngoc',
    contacts: [{ on: '2026-09-23', note: 'Đã trao đổi với mẹ của trẻ qua điện thoại.' }],
    externalResults: [
      {
        on: '2026-10-01',
        facility: 'Chấn thương chỉnh hình – Bệnh viện Trẻ em Hải Phòng',
        note: 'Phụ huynh báo bác sĩ chuyên khoa kết luận bàn chân bẹt, cho trẻ mang giày chỉnh hình; không hẹn khám lại.',
      },
    ],
    closed: {
      on: '2026-10-05',
      reason: 'Đã khám chuyên khoa; trẻ mang giày chỉnh hình, không còn lịch khám lại.',
      outcome: 'KNOWN_CONDITION',
      conditionText: 'Bàn chân bẹt – mang giày chỉnh hình',
    },
  },
  // Mở từ phiếu khám của đợt đang diễn ra (c1).
  { childId: 'ch_005', campusId: 'c1', teacherId: 'u_an', fromCampaign: OPEN_CAMPAIGN.id },
  { childId: 'ch_006', campusId: 'c1', teacherId: 'u_an', fromCampaign: OPEN_CAMPAIGN.id },
  { childId: 'ch_902', campusId: 'c1', teacherId: 'u_an', fromCampaign: OPEN_CAMPAIGN.id },
  { childId: 'ch_016', campusId: 'c1', teacherId: 'u_mai', fromCampaign: OPEN_CAMPAIGN.id },
  { childId: 'ch_021', campusId: 'c1', teacherId: 'u_hoa', fromCampaign: OPEN_CAMPAIGN.id },
  // Mở từ phiếu khám của đợt đã đóng đầu tháng 10 (c2).
  {
    id: 'fu_ch_025_2610',
    childId: 'ch_025',
    campusId: 'c2',
    teacherId: 'u_tuan',
    fromCampaign: C2_OCT_CAMPAIGN.id,
    externalResults: [
      {
        on: '2026-10-14',
        facility: 'Tai mũi họng – Bệnh viện Trẻ em Hải Phòng',
        note: 'Phụ huynh báo bác sĩ đã làm sạch tai, đo thính lực; hẹn khám lại sau 1 tháng.',
        nextVisitOn: '2026-11-14',
        images: [SAMPLE_RESULT_IMAGE],
      },
    ],
  },
  // Không có người đi cùng, chưa trao đổi từ 6/10 ⇒ quá hạn 7 ngày.
  { id: 'fu_ch_033_2610', childId: 'ch_033', campusId: 'c2', teacherId: 'u_ngoc', fromCampaign: C2_OCT_CAMPAIGN.id },
];

const hasExamCompanion = (m) => m?.exam?.admin?.hasCompanion === 'YES';

// Cùng câu chữ với lần trao đổi hệ thống ghi khi lưu kết luận có người đi cùng.
const examContactNote = (m) => {
  const { companion } = m.exam.admin;
  const c = m.exam.conclusion;
  const parts = [`Bác sĩ trao đổi kết luận với ${companion.fullName} (${companion.relation}) tại buổi khám.`];
  if (c.parentOpinion) parts.push(`Ý kiến phụ huynh: ${c.parentOpinion}`);
  if (c.tbRisk) parts.push('Kết luận có nguy cơ mắc lao (tiền sử tiếp xúc).');
  if (c.action === 'REFERRAL') parts.push(`Đề nghị khám chuyên khoa: ${c.specialty}.`);
  if (c.adviceText) parts.push(`Lời dặn: ${c.adviceText}`);
  return parts.join(' ').slice(0, 500);
};

const examContactEvent = (m, teacherId) => ({
  at: m.createdAt,
  userId: teacherId,
  action: 'PARENT_CONTACTED',
  on: m.date,
  note: examContactNote(m),
  atExam: true,
  measurementId: m.id,
});

/** Phiếu seed dạng dòng thời gian; repository tính trạng thái (normalizeFollowUp). */
export const buildSeedFollowUps = (measurements = []) =>
  SEED_FOLLOW_UPS.map((f) => {
    const own = measurements.filter((m) => m.childId === f.childId);
    const fromExam = f.fromCampaign ? own.find((m) => m.campaignId === f.fromCampaign && m.examStatus === 'CONCLUDED') : null;
    if (f.fromCampaign && !fromExam) return null;
    const openedOn = fromExam?.date || f.openedOn || '2026-09-15';
    const source = fromExam || own.find((m) => m.date === openedOn);
    if (!source) return null;
    // Kết quả mới ở đợt đang diễn ra ghi vào phiếu còn mở (1 phiếu mở/trẻ); phiếu nháp chưa là kết quả.
    const current = !f.closed && !fromExam ? own.find((m) => m.campaignId === OPEN_CAMPAIGN.id && m.examStatus !== 'DRAFT') : null;
    const { teacherId } = f;
    const opened = `${openedOn}T08:30:00.000Z`;
    const at = (on) => `${on}T03:00:00.000Z`;
    // Phiếu khám mẫu FOLLOW_UP: chỉ "Có thêm bất thường mới" hoặc nguy cơ lao mở vòng (user chốt 2026-10-21).
    const finding = current?.exam?.conclusion?.followUpFinding || null;
    const newFinding = !finding || finding === 'NEW_FINDING' || !!current?.exam?.conclusion?.tbRisk;
    const closedEvent = f.closed && {
      at: at(f.closed.on),
      userId: teacherId,
      action: 'CLOSED',
      note: f.closed.reason,
      outcome: f.closed.outcome,
      ...(f.closed.conditionText ? { conditionText: f.closed.conditionText } : {}),
    };
    const history = [
      { at: opened, userId: teacherId, action: 'OPENED', measurementId: source.id, examOn: source.date },
      ...(hasExamCompanion(fromExam) ? [examContactEvent(fromExam, teacherId)] : []),
      ...(f.contacts || []).map((c) => ({ at: at(c.on), userId: teacherId, action: 'PARENT_CONTACTED', on: c.on, note: c.note })),
      ...(f.externalResults || []).map((x) => ({
        at: at(x.on),
        userId: teacherId,
        action: 'EXTERNAL_RESULT',
        on: x.on,
        note: x.note,
        facility: x.facility || '',
        images: x.images || [],
        nextVisitOn: x.nextVisitOn || null,
      })),
      ...(closedEvent ? [closedEvent] : []),
      ...(current
        ? [
            {
              at: current.createdAt,
              userId: teacherId,
              action: 'MEASUREMENT_ADDED',
              measurementId: current.id,
              examOn: current.date,
              ...(finding ? { newFinding } : {}),
            },
            ...(newFinding && hasExamCompanion(current) ? [examContactEvent(current, teacherId)] : []),
          ]
        : []),
    ].sort((a, b) => a.at.localeCompare(b.at));
    return {
      id: f.id || `fu_${f.childId}`,
      childId: f.childId,
      campusId: f.campusId,
      measurementIds: [source.id, ...(current ? [current.id] : [])],
      openedAt: opened,
      updatedAt: history[history.length - 1].at,
      closeReason: f.closed?.reason || null,
      closeOutcome: f.closed?.outcome || null,
      closeConditionText: f.closed?.conditionText || null,
      closedAt: f.closed ? at(f.closed.on) : null,
      closedBy: f.closed ? teacherId : null,
      history,
    };
  }).filter(Boolean);
