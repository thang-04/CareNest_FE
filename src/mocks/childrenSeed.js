/*
 * Fictional health and parent-account data for the seeded children (no real child data).
 * Built from db.children / db.classes so ids always match; the children repository seeds it lazily.
 */

import { OPEN_CAMPAIGN, SEED_CAMPAIGN_DATES, openCampaignDates, seedCampaignId } from './healthCheckSeed';

// Ngày khám của các đợt đã đóng (khớp healthCheckSeed); đợt tháng 9 là lần gần nhất.
const DATES = ['2026-03-16', '2026-06-15', '2026-09-15'];
const LATEST_DATE = '2026-09-15';
// Cân đo tại lớp trước khi có vòng đầu/vận động: dữ liệu cũ chỉ có chiều cao, cân nặng (ngoài đợt khám).
const LEGACY_DATE = '2025-12-15';
// Trẻ vắng ngày khám của đợt (không có kết quả): đợt tháng 3 là trẻ có n chia hết cho 9, đợt tháng 6 như dưới.
const ABSENT_JUNE = ['ch_013', 'ch_029'];

/*
 * Kết quả bất thường dựng sẵn cho đợt tháng 3 và tháng 6 (dữ liệu giả) để các đợt cũ có trẻ cần theo dõi
 * và thấy diễn biến qua các đợt. head: độ lệch vòng đầu (cm), gross/fine: vận động có bất thường.
 */
const PAST_ABNORMAL = {
  '2026-03-16': {
    2: { fine: true },
    11: { head: -3.2 },
    14: { head: 5.5, gross: true },
    16: { fine: true },
    23: { fine: true },
    30: { gross: true },
  },
  '2026-06-15': { 3: { fine: true }, 8: { head: 5.5 }, 19: { gross: true }, 25: { head: -3.2, gross: true } },
};

// Đợt tháng 9: vài trẻ đạt 1 hoặc 2 tiêu chí (phiếu theo dõi seed dựa vào các kết quả này).
const latestAbnormal = (n) => ({
  head: n % 8 === 3 ? -3.2 : n % 12 === 7 ? 5.5 : 0,
  fine: n % 8 === 3 || n % 10 === 5,
  gross: n % 12 === 7 && n > 12,
});

const EXAM_NOTES = {
  '2026-03-16': (idx) => (idx % 6 === 0 ? 'Răng miệng bình thường.' : ''),
  '2026-06-15': (idx) => (idx % 7 === 3 ? 'Bác sĩ dặn nhắc trẻ uống đủ nước, ngủ trưa đủ giấc.' : ''),
  '2026-09-15': (idx) => (idx % 8 === 5 ? 'Mắt, tai mũi họng bình thường.' : ''),
};

// Kết quả đã nhập trong đợt đang diễn ra (điểm trường c1): 1 trẻ bình thường, 1 cần theo dõi, 1 cần theo dõi sát.
const OPEN_CAMPAIGN_RESULTS = {
  ch_001: { headOffset: 0, gross: 'NO_ABNORMALITY', fine: 'NO_ABNORMALITY' },
  ch_002: { headOffset: 0.4, gross: 'ABNORMAL', fine: 'NO_ABNORMALITY' },
  ch_003: { headOffset: -3.4, gross: 'NO_ABNORMALITY', fine: 'ABNORMAL' },
};

const ageMonthsOn = (dob, on) => {
  const [y1, m1, d1] = dob.split('-').map(Number);
  const [y2, m2, d2] = on.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
};

const round1 = (n) => Math.round(n * 10) / 10;
const motor = (abnormal) => (abnormal ? 'ABNORMAL' : 'NO_ABNORMALITY');

const buildMeasurements = (children, classes) => {
  const classById = Object.fromEntries(classes.map((c) => [c.id, c]));
  const list = [];
  children
    .filter((ch) => ch.status === 'ACTIVE' && ch.id.startsWith('ch_') && /^ch_\d+$/.test(ch.id))
    .forEach((ch, idx) => {
      const n = Number(ch.id.slice(3));
      const cls = classById[ch.classId];
      const teacherId = cls?.homeroomTeacherId || null;
      // A few children get a profile outside the normal band so the demo shows every status.
      const weightFactor = n % 11 === 0 ? 0.78 : n % 13 === 0 ? 1.32 : 1 + ((n % 5) - 2) * 0.03;
      const heightAt = (age) => 87 + (age - 24) * 0.6 + ((n % 4) - 1.5) * 1.2;
      const weightAt = (age) => (12 + (age - 24) * 0.17) * weightFactor;

      if (idx % 3 === 0 && ageMonthsOn(ch.dateOfBirth, LEGACY_DATE) >= 0) {
        const age = ageMonthsOn(ch.dateOfBirth, LEGACY_DATE);
        list.push({
          id: `hm_${ch.id}_legacy`,
          childId: ch.id,
          date: LEGACY_DATE,
          heightCm: round1(heightAt(age)),
          weightKg: round1(weightAt(age)),
          headCircumferenceCm: null,
          grossMotor: null,
          fineMotor: null,
          note: 'Cân đo tại lớp.',
          campaignId: null,
          measuredBy: teacherId,
          published: true,
          publishedAt: `${LEGACY_DATE}T09:00:00.000Z`,
          createdAt: `${LEGACY_DATE}T08:30:00.000Z`,
          edits: [],
        });
      }

      const dates = DATES.filter((date) => !(date === DATES[0] && n % 9 === 0) && !(date === DATES[1] && ABSENT_JUNE.includes(ch.id)));
      dates.forEach((date, k) => {
        const age = ageMonthsOn(ch.dateOfBirth, date);
        if (age < 0) return;
        // The latest check of child 7, 14 … shows a slower weight gain for the AI trend demo.
        const slow = n % 7 === 0 && date === LATEST_DATE ? -0.6 : 0;
        const special = date === LATEST_DATE ? latestAbnormal(n) : PAST_ABNORMAL[date]?.[n] || {};
        const head = 46.3 + (age - 24) * 0.075 + (special.head || ((n % 5) - 2) * 0.4);
        list.push({
          id: `hm_${ch.id}_${k}`,
          childId: ch.id,
          date,
          heightCm: round1(heightAt(age)),
          weightKg: round1(weightAt(age) + slow),
          headCircumferenceCm: age > 60 ? null : round1(head),
          grossMotor: motor(special.gross),
          fineMotor: motor(special.fine),
          note: EXAM_NOTES[date](idx),
          campaignId: SEED_CAMPAIGN_DATES.includes(date) ? seedCampaignId(ch.campusId, date) : null,
          measuredBy: teacherId,
          published: true,
          publishedAt: `${date}T09:00:00.000Z`,
          createdAt: `${date}T08:30:00.000Z`,
          edits: [],
        });
      });
      const open = OPEN_CAMPAIGN_RESULTS[ch.id];
      if (open && ch.campusId === OPEN_CAMPAIGN.campusId) {
        const date = openCampaignDates().entryDate;
        const age = ageMonthsOn(ch.dateOfBirth, date);
        list.push({
          id: `hm_${ch.id}_open`,
          childId: ch.id,
          date,
          heightCm: round1(heightAt(age) + 0.6),
          weightKg: round1((12.2 + (age - 24) * 0.17) * weightFactor),
          headCircumferenceCm: age > 60 ? null : round1(46.4 + (age - 24) * 0.075 + open.headOffset),
          grossMotor: open.gross,
          fineMotor: open.fine,
          note: '',
          campaignId: OPEN_CAMPAIGN.id,
          measuredBy: teacherId,
          published: false,
          publishedAt: null,
          createdAt: `${date}T08:30:00.000Z`,
          edits: [],
        });
      }
    });
  return list;
};

const buildDeclarations = (children) =>
  children.map((ch, i) => ({
    childId: ch.id,
    allergies: ch.allergies.length ? { state: 'REPORTED', items: [...ch.allergies] } : { state: 'NONE_REPORTED', items: [] },
    diet:
      i % 5 === 0
        ? { state: 'REPORTED', text: 'Ăn cháo/cơm nát, không ăn đồ cay.' }
        : { state: i % 3 === 0 ? 'NOT_PROVIDED' : 'NONE_REPORTED', text: '' },
    otherNotes: { state: 'NOT_PROVIDED', text: '' },
    declaredBy: 'u_lan',
    declaredAt: ch.enrolledAt ? `${ch.enrolledAt}T02:00:00.000Z` : null,
    history: [],
  }));

const buildParentAccounts = (children) => {
  const accounts = [];
  children.forEach((ch) =>
    (ch.guardians || []).forEach((g) => {
      if (g.accountStatus !== 'ACTIVE') return;
      const phone = g.phone.replace(/\s/g, '');
      const existing = accounts.find((a) => a.phone === phone);
      if (existing) existing.childIds.push(ch.id);
      else
        accounts.push({
          id: `pa_${ch.id}`,
          username: phone,
          phone,
          email: g.email || '',
          fullName: g.fullName,
          status: 'ACTIVE',
          childIds: [ch.id],
          createdAt: '2026-08-16T02:00:00.000Z',
          sms: [{ at: '2026-08-16T02:00:00.000Z', status: 'SENT' }],
        });
    }),
  );
  return accounts;
};

export const buildSeedChildRecords = ({ children = [], classes = [] }) => ({
  healthMeasurements: buildMeasurements(children, classes),
  healthDeclarations: buildDeclarations(children),
  parentAccounts: buildParentAccounts(children),
  childPlacements: [],
});
