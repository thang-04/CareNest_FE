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

/**
 * measurements/children: kết quả và trẻ seed — trẻ seed đang học chưa có kết quả trong đợt đã đóng là "Vắng khám".
 */
export const buildSeedHealthChecks = ({ today = todayInput(), measurements = [], children = [] } = {}) => {
  const open = openCampaignDates(today);
  const upcomingStart = addDays(today, 7);
  const base = { examiner: EXAMINER, note: '', createdBy: PRINCIPAL_ID, cancelledAt: null, absentChildIds: [] };
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
  return [
    ...past,
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
      id: 'hc_c2_next',
      name: `Khám sức khỏe định kỳ ${monthName(upcomingStart)}`,
      campusId: 'c2',
      startDate: upcomingStart,
      endDate: addDays(upcomingStart, 2),
      createdAt: `${today}T01:00:00.000Z`,
      closedAt: null,
      closedBy: null,
      history: [event(today, 'CREATED')],
    },
  ];
};

/**
 * Phiếu theo dõi demo cho các trẻ có kết quả "Cần theo dõi sát" ở các đợt đã đóng (đủ các trạng thái).
 * openedOn: ngày khám mở phiếu. Nội dung chỉ ghi việc trao đổi và lời bác sĩ phụ huynh báo lại, không có chẩn đoán.
 */
const SEED_FOLLOW_UPS = [
  {
    childId: 'ch_014',
    campusId: 'c1',
    teacherId: 'u_mai',
    openedOn: '2026-03-16',
    contact: { on: '2026-03-19', note: 'Trao đổi trực tiếp với mẹ của trẻ, đề nghị đưa trẻ đi khám chuyên khoa nhi.' },
    externalResult: { on: '2026-04-08', note: 'Phụ huynh báo bác sĩ chuyên khoa hẹn khám lại khi có thay đổi.' },
    closed: { on: '2026-05-05', reason: 'Phụ huynh đã cho trẻ khám chuyên khoa; nhà trường theo dõi tiếp ở các đợt khám sau.' },
  },
  {
    childId: 'ch_025',
    campusId: 'c2',
    teacherId: 'u_tuan',
    openedOn: '2026-06-15',
    contact: { on: '2026-06-17', note: 'Đã gọi điện cho bố của trẻ, gửi kết quả khám và đề nghị khám chuyên khoa trong kỳ nghỉ hè.' },
    closed: { on: '2026-08-20', reason: 'Phụ huynh báo đã đưa trẻ đi khám; theo dõi tiếp ở đợt khám đầu năm học.' },
  },
  {
    childId: 'ch_003',
    campusId: 'c1',
    teacherId: 'u_an',
    contact: { on: '2026-09-22', note: 'Đã gọi điện cho mẹ của trẻ, đề nghị đưa trẻ đi khám chuyên khoa nhi.' },
  },
  { childId: 'ch_011', campusId: 'c1', teacherId: 'u_minhanh' },
  {
    childId: 'ch_019',
    campusId: 'c1',
    teacherId: 'u_hoa',
    contact: { on: '2026-09-19', note: 'Trao đổi trực tiếp với bố của trẻ khi đón trẻ, gửi kèm kết quả khám của đợt.' },
    externalResult: { on: '2026-10-02', note: 'Phụ huynh báo bác sĩ chuyên khoa hẹn khám lại sau 3 tháng.' },
  },
  { childId: 'ch_027', campusId: 'c2', teacherId: 'u_tuan' },
  {
    childId: 'ch_031',
    campusId: 'c2',
    teacherId: 'u_ngoc',
    contact: { on: '2026-09-23', note: 'Đã trao đổi với mẹ của trẻ qua điện thoại.' },
    closed: { on: '2026-10-05', reason: 'Phụ huynh đã cho trẻ khám; nhà trường tiếp tục theo dõi ở đợt khám sau.' },
  },
];

export const buildSeedFollowUps = (measurements = []) =>
  SEED_FOLLOW_UPS.map((f) => {
    const openedOn = f.openedOn || '2026-09-15';
    const own = measurements.filter((m) => m.childId === f.childId);
    const source = own.find((m) => m.date === openedOn);
    if (!source) return null;
    // Kết quả mới ở đợt đang diễn ra ghi thêm vào phiếu còn mở (1 phiếu mở/trẻ).
    const current = !f.closed ? own.find((m) => m.campaignId === OPEN_CAMPAIGN.id) : null;
    const { teacherId } = f;
    const opened = `${openedOn}T08:30:00.000Z`;
    const at = (on) => `${on}T03:00:00.000Z`;
    const history = [{ at: opened, userId: teacherId, action: 'OPENED' }];
    if (f.contact) history.push({ at: at(f.contact.on), userId: teacherId, action: 'PARENT_CONTACTED', note: f.contact.note });
    if (f.externalResult)
      history.push({ at: at(f.externalResult.on), userId: teacherId, action: 'EXTERNAL_RESULT', note: f.externalResult.note });
    if (f.closed) history.push({ at: at(f.closed.on), userId: teacherId, action: 'CLOSED', note: f.closed.reason });
    if (current) history.push({ at: current.createdAt, userId: teacherId, action: 'MEASUREMENT_ADDED' });
    const by = (x) => (x ? { on: x.on, note: x.note, by: teacherId, at: at(x.on) } : null);
    return {
      id: `fu_${f.childId}`,
      childId: f.childId,
      campusId: f.campusId,
      measurementIds: [source.id, ...(current ? [current.id] : [])],
      status: f.closed
        ? 'CLOSED'
        : f.externalResult
          ? 'EXTERNAL_RESULT_RECORDED'
          : f.contact
            ? 'PARENT_CONTACTED'
            : 'WAITING_PARENT_CONTACT',
      openedAt: opened,
      updatedAt: history[history.length - 1].at,
      contact: by(f.contact),
      externalResult: by(f.externalResult),
      closeReason: f.closed?.reason || null,
      closedAt: f.closed ? at(f.closed.on) : null,
      closedBy: f.closed ? teacherId : null,
      history,
    };
  }).filter(Boolean);
