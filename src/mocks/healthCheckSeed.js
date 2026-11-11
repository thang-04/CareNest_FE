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

/** Đợt đã đóng đầu tháng 10 ở điểm trường c2, nhập theo phiếu Phụ lục II (có phiếu chưa kết luận). */
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

/** Kỳ cân đo đang diễn ra ở c2 (user chốt 2026-10-31): Lớp Lá A đã cân đo, Lớp Mầm 1 có 2 trẻ (có cảnh báo BMI, HLT-18). */
export const MEASUREMENT_ROUND = { id: 'hc_c2_next', campusId: 'c2' };

const C2_ROUND_FIELDS = {
  ...MEASUREMENT_ROUND,
  kind: 'MEASUREMENT',
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
