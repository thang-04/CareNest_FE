/*
 * Fictional health and parent-account data for the seeded children (no real child data).
 * Built from db.children / db.classes so ids always match; the children repository seeds it lazily.
 */

import { GUARDIAN_TO_COMPANION_RELATION, buildEmptyExam } from '@/models/children/healthExamForm';
import { C2_OCT_CAMPAIGN, OPEN_CAMPAIGN, SEED_CAMPAIGN_DATES, openCampaignDates, seedCampaignId } from './healthCheckSeed';

// Ngày khám của các đợt đã đóng (khớp healthCheckSeed); đợt tháng 9 là lần gần nhất.
const DATES = ['2026-03-16', '2026-06-15', '2026-09-15'];
const LATEST_DATE = '2026-09-15';
// Cân đo tại lớp trước khi có vòng đầu/vận động: dữ liệu cũ chỉ có chiều cao, cân nặng (ngoài đợt khám).
const LEGACY_DATE = '2025-12-15';
// Cân đo tại lớp sau khi có phiếu Phụ lục II (ngoài đợt khám).
const CLASS_MEASURE_DATE = '2026-10-10';
// Trẻ vắng ngày khám của đợt (không có kết quả): đợt tháng 3 là trẻ có n chia hết cho 9, đợt tháng 6 như dưới.
const ABSENT_JUNE = ['ch_013', 'ch_029'];
// Kết quả "Cần theo dõi sát" tháng 9 của trẻ có phiếu còn chờ trao đổi: chưa công bố (trao đổi với phụ huynh trước khi công bố).
const UNPUBLISHED_LATEST = ['ch_011', 'ch_027'];

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

const DOCTOR = 'BS. Nguyễn Minh Tâm';
const DOCTOR_C2 = 'BS. Đặng Quốc Việt';

/*
 * Phiếu Phụ lục II dựng sẵn để thử mọi trường hợp (dữ liệu giả). Mỗi trẻ 1 trường hợp, ghi ở `case`.
 * campaign: 'open' = đợt đang diễn ra ở điểm trường c1; C2_OCT_CAMPAIGN.id = đợt đã đóng đầu tháng 10 ở c2.
 * draft: phiếu nháp dừng ở bước đó (0–4); các bước trước đã nhập đủ. legacy: kết quả mẫu cũ nhập trong đợt.
 * Phiếu đã kết luận có người đi cùng là đã công bố; không có người đi cùng thì chưa công bố (chờ trao đổi).
 * Số định danh giả bắt đầu bằng 999 (không có mã tỉnh này). Lớp Chồi 1 để trống: khám từ đầu.
 */
const EXAM_CASES = {
  /* ---------- Lớp Mầm 1 (c1, cô An) ---------- */
  ch_001: { case: 'Bình thường, có người đi cùng: tự công bố khi lưu kết luận' },
  ch_002: {
    case: 'Có vấn đề, tư vấn; trẻ 35 tháng (nhóm 12–35 tháng) thở nhanh; phiếu đã sửa có lý do',
    headOffset: 0.4,
    vitals: { respiratoryRate: 40, respiratoryStatus: 'FAST' },
    clinical: { dentalIssue: 'YES' },
    conclusion: {
      normal: false,
      healthIssue: true,
      issueText: 'Răng có mảng bám, vài vết sâu nhỏ; thở nhanh khi khám.',
      action: 'ADVICE',
      adviceText: 'Cho trẻ đánh răng 2 lần mỗi ngày, hạn chế đồ ngọt buổi tối; theo dõi nhịp thở khi trẻ ốm.',
    },
    edited: { weightFrom: 0.4, reason: 'Cân lại sau khi trẻ cởi áo khoác.' },
  },
  ch_003: {
    case: 'Trẻ đang có phiếu theo dõi: "Có thêm bất thường mới", KHÔNG có người đi cùng ⇒ vòng mới, chờ trao đổi 7 ngày, chưa công bố được; gợi ý kết hợp 2 dấu hiệu',
    headOffset: -3.4,
    noCompanion: true,
    headStatus: 'SMALL',
    development: { motor: 'NO' },
    conclusion: {
      normal: false,
      action: '',
      followUpFinding: 'NEW_FINDING',
      issueText: 'Vòng đầu nhỏ, vận động chưa theo kịp độ tuổi.',
      specialty: 'Nhi khoa – khám phát triển',
      adviceText: 'Phụ huynh đưa trẻ đi khám chuyên khoa và báo lại nhà trường.',
    },
  },
  ch_004: { case: 'Phiếu nháp dừng ở bước 2 (sinh tồn, dinh dưỡng)', draft: 1, headOffset: 0.2 },
  ch_005: {
    case: 'Chuyển khám có người đi cùng: trao đổi ghi tại buổi khám, công bố được; sốt + mạch nhanh',
    headOffset: 0.3,
    vitals: { temperatureC: 37.8, temperatureStatus: 'FEVER', pulse: 132, pulseStatus: 'FAST' },
    clinical: { strabismus: 'YES' },
    conclusion: {
      normal: false,
      healthIssue: true,
      issueText: 'Lác mắt; sốt nhẹ trong buổi khám.',
      action: 'REFERRAL',
      specialty: 'Mắt',
      adviceText: 'Theo dõi nhiệt độ ở nhà; đưa trẻ khám chuyên khoa mắt.',
    },
  },
  ch_006: {
    case: 'Nguy cơ mắc lao (tiền sử tiếp xúc), có người đi cùng',
    headOffset: -0.2,
    history: { tbContact: 'YES', tbContactDate: '2026-09-05' },
    conclusion: {
      normal: false,
      tbRisk: true,
      action: 'REFERRAL',
      specialty: 'Lao và bệnh phổi – Trung tâm Y tế',
      adviceText: 'Đưa trẻ đến cơ sở y tế để được khám sàng lọc lao.',
    },
  },
  ch_037: {
    case: 'Trẻ 27 tháng: có câu nguy cơ tự kỷ; người đi cùng là mẹ',
    headOffset: 0,
    development: { mental: 'NO', autismRisk: 'YES' },
    conclusion: {
      normal: false,
      healthIssue: true,
      issueText: 'Chậm nói so với độ tuổi; bác sĩ đánh dấu nguy cơ tự kỷ theo mẫu sàng lọc.',
      action: 'REFERRAL',
      specialty: 'Nhi khoa – khám phát triển, tâm lý trẻ em',
      adviceText: 'Đưa trẻ đi khám chuyên khoa sớm; ở nhà tăng trò chuyện, đọc sách cùng trẻ.',
    },
  },
  /* ---------- Lớp Chồi 2 (c1, cô Mai, cô Hà) ---------- */
  ch_013: { case: 'Phiếu nháp dừng ở bước 4 (khám lâm sàng)', draft: 3, headOffset: 0.1 },
  ch_014: {
    case: 'Phiếu nháp ở bước Kết luận: hạ thân nhiệt, mạch thấp hơn khoảng, thở chậm, vòng đầu to (gợi ý 1 dấu hiệu)',
    draft: 4,
    headOffset: 5,
    headStatus: 'LARGE',
    vitals: {
      temperatureC: 35.6,
      temperatureStatus: 'HYPOTHERMIA',
      pulse: 72,
      pulseStatus: 'NORMAL',
      respiratoryRate: 16,
      respiratoryStatus: 'SLOW',
    },
  },
  ch_015: {
    case: 'Bình thường nhưng có lời tư vấn; bác sĩ chọn khác gợi ý (mạch 125 chọn Bình thường, 37,2 °C chọn Sốt)',
    headOffset: 0,
    vitals: { temperatureC: 37.2, temperatureStatus: 'FEVER', pulse: 125, pulseStatus: 'NORMAL' },
    conclusion: { action: 'ADVICE', adviceText: 'Cho trẻ uống đủ nước, nghỉ ngơi; đo lại nhiệt độ buổi chiều.' },
  },
  ch_016: {
    case: 'Nguy cơ lao + có vấn đề; người đi cùng là ông (không có trong hồ sơ); tiền sử, sinh non, thiếu cân, thiếu máu, chưa tiêm đủ, buồn bã kéo dài',
    headOffset: -0.6,
    weightFactor: 0.8,
    companion: { fullName: 'Lê Văn Bảy', relation: 'Ông/bà', phone: '0912 000 016', idNumber: '999195500016' },
    admin: { premature: 'YES', gestationWeeks: 35, bloodType: 'O', beneficiary: 'Hộ cận nghèo' },
    history: {
      self: 'YES',
      selfText: 'Viêm phổi lúc 2 tuổi',
      family: 'YES',
      familyText: 'Ông nội từng điều trị lao',
      tbContact: 'YES',
      tbContactDate: '2026-08-20',
    },
    nutrition: { statuses: ['MALNUTRITION', 'ANEMIA_SIGNS'], weightForAgeSd: -2.4, lengthForAgeSd: -1.1, armCircumferenceMm: 128 },
    immunization: { fullSchedule: 'NO' },
    clinical: {
      palms: 'PALE',
      skinColor: 'PALE',
      prolongedSadness: 'YES',
      behaviorNote: 'Trẻ hay quấy khóc về đêm, ngủ không yên (người đi cùng kể).',
    },
    conclusion: {
      normal: false,
      tbRisk: true,
      healthIssue: true,
      issueText: 'Thiếu cân, có dấu hiệu thiếu máu; ngủ không yên kéo dài.',
      action: 'REFERRAL',
      specialty: 'Lao và bệnh phổi – Trung tâm Y tế; Nhi khoa (dinh dưỡng)',
      adviceText: 'Khám sàng lọc lao sớm; bổ sung bữa phụ giàu sắt; hoàn thành mũi tiêm còn thiếu.',
    },
  },
  ch_017: {
    case: 'Có vấn đề (thừa cân), tư vấn; có chỉ số SD và vòng cánh tay',
    headOffset: 0.3,
    weightFactor: 1.3,
    nutrition: { statuses: ['OVERWEIGHT'], weightForAgeSd: 2.3, lengthForAgeSd: 0.4, armCircumferenceMm: 205 },
    conclusion: {
      normal: false,
      healthIssue: true,
      issueText: 'Thừa cân so với tuổi.',
      action: 'ADVICE',
      adviceText: 'Giảm đồ ngọt, nước ngọt; tăng vận động ngoài trời mỗi ngày.',
    },
  },
  ch_018: { case: 'Kết quả mẫu cũ nhập trong đợt (trước phiếu Phụ lục II)', legacy: { gross: 'NO_ABNORMALITY', fine: 'ABNORMAL' } },
  /* ---------- Lớp Lá 1 (c1, cô Hoa; trẻ trên 60 tháng không đo vòng đầu, ví dụ ch_020) ---------- */
  ch_019: {
    case: 'Trẻ đang có phiếu theo dõi (có kết quả chuyên khoa, hẹn khám lại): "Chưa ghi nhận thêm bất thường" ⇒ phiếu giữ nguyên',
    clinical: { gait: 'ABNORMAL', asymmetricMotion: 'YES' },
    conclusion: { normal: false, action: '', followUpFinding: 'NO_NEW_FINDING' },
  },
  ch_020: { case: 'Bình thường, trẻ trên 60 tháng (không đo vòng đầu)' },
  ch_023: {
    case: 'Vấn đề đã biết, không thay đổi (cận thị đang đeo kính): mức Vấn đề đã biết, ổn định, không vào danh sách Trẻ cần theo dõi',
    history: { self: 'YES', selfText: 'Cận thị – đeo kính' },
    conclusion: {
      normal: false,
      healthIssue: true,
      issueKind: 'KNOWN',
      issueText: 'Cận thị – đeo kính, nhìn rõ khi đeo kính.',
      action: 'ADVICE',
      adviceText: 'Đeo kính đúng số; khám mắt định kỳ theo hẹn.',
    },
  },
  ch_021: {
    case: 'Chuyển khám, không có người đi cùng; gợi ý kết hợp 2 dấu hiệu phát triển (cân nhắc chuyển khám)',
    noCompanion: true,
    development: { mental: 'NO', motor: 'NO' },
    conclusion: {
      normal: false,
      healthIssue: true,
      issueText: 'Phát triển tinh thần và vận động chưa theo kịp độ tuổi.',
      action: 'REFERRAL',
      specialty: 'Nhi khoa – khám phát triển',
    },
  },
  ch_022: { case: 'Phiếu nháp dừng ở bước 1 (mới nhập hành chính)', draft: 0 },
  /* ---------- Đợt đã đóng đầu tháng 10 ở c2 (thầy Tuấn: Mầm 1; cô Ngọc: Lá A) ---------- */
  ch_025: {
    case: 'Đợt đã đóng: chuyển khám có người đi cùng, đã có kết quả chuyên khoa (chuyên khoa, ảnh, hẹn khám lại)',
    campaign: 'c2_oct',
    headOffset: 0.2,
    clinical: { hearing: 'ABNORMAL', earDischarge: 'YES' },
    conclusion: {
      normal: false,
      healthIssue: true,
      issueText: 'Đáp ứng âm thanh kém, tai phải chảy dịch.',
      action: 'REFERRAL',
      specialty: 'Tai mũi họng',
      adviceText: 'Giữ tai khô; đưa trẻ khám chuyên khoa tai mũi họng trong tuần.',
    },
  },
  ch_026: { case: 'Đợt đóng khi phiếu còn nháp: "Chưa kết luận"', campaign: 'c2_oct', draft: 2, headOffset: 0 },
  ch_028: { case: 'Đợt đã đóng: bình thường', campaign: 'c2_oct', headOffset: -0.1 },
  ch_029: {
    case: 'Đợt đã đóng: có vấn đề, tư vấn',
    campaign: 'c2_oct',
    headOffset: 0.4,
    clinical: { runnyNose: 'YES', nasalCongestion: 'YES' },
    conclusion: {
      normal: false,
      healthIssue: true,
      issueText: 'Chảy nước mũi, nghẹt mũi.',
      action: 'ADVICE',
      adviceText: 'Vệ sinh mũi bằng nước muối sinh lý; giữ ấm khi trời lạnh.',
    },
  },
  ch_032: { case: 'Đợt đã đóng: bình thường, trẻ trên 60 tháng', campaign: 'c2_oct' },
  ch_033: {
    case: 'Đợt đã đóng: chuyển khám không có người đi cùng, quá hạn trao đổi',
    campaign: 'c2_oct',
    noCompanion: true,
    clinical: { eyelids: 'DISCHARGE' },
    conclusion: {
      normal: false,
      healthIssue: true,
      issueText: 'Mắt chảy ghèn nhiều.',
      action: 'REFERRAL',
      specialty: 'Mắt',
      adviceText: 'Đưa trẻ khám chuyên khoa mắt.',
    },
  },
};

const pad5 = (n) => String(n).padStart(5, '0');

/** Phiếu theo trường hợp; phiếu nháp chỉ có các bước trước bước đang dừng. */
const seedExam = (ch, n, spec, { headApplies, doctor }) => {
  const e = buildEmptyExam();
  const g = ch.guardians?.[0];
  const stop = spec.draft ?? 5;
  e.step = Math.min(stop, 4);
  Object.assign(e.admin, {
    childIdNumber: `999${ch.dateOfBirth.slice(0, 4)}${pad5(n)}`,
    premature: 'NO',
    gestationWeeks: 39,
    ethnicity: 'Kinh',
    paymentSource: 'Gia đình chi trả',
    address: { province: 'Hải Phòng', ward: 'Thượng Hồng', street: `Thôn ${(n % 5) + 1}` },
    hasCompanion: spec.noCompanion ? 'NO' : 'YES',
    ...spec.admin,
  });
  if (spec.companion) e.admin.companion = { guardianIndex: null, ...spec.companion };
  else if (!spec.noCompanion && g)
    e.admin.companion = {
      guardianIndex: 0,
      fullName: g.fullName,
      relation: GUARDIAN_TO_COMPANION_RELATION[g.relation] || 'Khác',
      phone: g.phone,
      idNumber: g.idNumber || '',
    };
  if (stop === 0) return e;
  Object.assign(e.history, { self: 'NO', family: 'NO', tbContact: 'NO' }, spec.history);
  if (stop === 1) return e;
  Object.assign(e.vitals, {
    temperatureC: 36.8,
    temperatureStatus: 'NORMAL',
    pulse: 104,
    pulseStatus: 'NORMAL',
    respiratoryRate: 24,
    respiratoryStatus: 'NORMAL',
    ...spec.vitals,
  });
  Object.assign(e.nutrition, {
    lengthForAgeSd: null,
    weightForAgeSd: null,
    headStatus: headApplies ? spec.headStatus || 'NORMAL' : '',
    armCircumferenceMm: 158 + (n % 4) * 3,
    statuses: ['NORMAL'],
    ...spec.nutrition,
  });
  if (stop === 2) return e;
  Object.assign(e.development, { mental: 'YES', motor: 'YES', autismRisk: '' }, spec.development);
  Object.assign(e.immunization, { bcg: 'YES', hepB1: 'YES', fullSchedule: 'YES' }, spec.immunization);
  if (stop === 3) return e;
  Object.assign(e.clinical, spec.clinical);
  if (stop === 4) return e;
  Object.assign(e.conclusion, { normal: true, action: 'NONE', doctorName: doctor }, spec.conclusion);
  return e;
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
        const held = date === LATEST_DATE && UNPUBLISHED_LATEST.includes(ch.id);
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
          published: !held,
          publishedAt: held ? null : `${date}T09:00:00.000Z`,
          createdAt: `${date}T08:30:00.000Z`,
          edits: [],
        });
      });
      // Cân đo ngoài đợt sau khi có phiếu Phụ lục II: chỉ số đo, không kết luận (user chốt 2026-10-17).
      if (ch.id === 'ch_008') {
        const age = ageMonthsOn(ch.dateOfBirth, CLASS_MEASURE_DATE);
        list.push({
          id: `hm_${ch.id}_class`,
          childId: ch.id,
          date: CLASS_MEASURE_DATE,
          heightCm: round1(heightAt(age) + 0.4),
          weightKg: round1(weightAt(age) + 0.2),
          headCircumferenceCm: null,
          grossMotor: null,
          fineMotor: null,
          exam: null,
          examStatus: null,
          note: 'Cân đo tại lớp, không có bác sĩ.',
          campaignId: null,
          measuredBy: teacherId,
          published: false,
          publishedAt: null,
          createdAt: `${CLASS_MEASURE_DATE}T08:30:00.000Z`,
          edits: [],
        });
      }
      const spec = EXAM_CASES[ch.id];
      const campaign = spec?.campaign === 'c2_oct' ? C2_OCT_CAMPAIGN : { ...OPEN_CAMPAIGN, date: openCampaignDates().entryDate };
      if (spec && ch.campusId === campaign.campusId) {
        const { date } = campaign;
        const age = ageMonthsOn(ch.dateOfBirth, date);
        const headApplies = age <= 60;
        // Phiếu nháp chưa tới bước số đo thì chưa có chiều cao, cân nặng, vòng đầu.
        const withNumbers = spec.draft == null || spec.draft >= 2;
        const concluded = spec.draft == null && !spec.legacy;
        const weightKg = withNumbers ? round1((12.2 + (age - 24) * 0.17) * (spec.weightFactor || weightFactor)) : '';
        list.push({
          id: `hm_${ch.id}_${spec.campaign === 'c2_oct' ? '2610' : 'open'}`,
          childId: ch.id,
          date,
          heightCm: withNumbers ? round1(heightAt(age) + 0.6) : '',
          weightKg,
          headCircumferenceCm: !withNumbers ? '' : headApplies ? round1(46.4 + (age - 24) * 0.075 + (spec.headOffset || 0)) : null,
          grossMotor: spec.legacy?.gross ?? null,
          fineMotor: spec.legacy?.fine ?? null,
          note: spec.legacy ? 'Nhập theo mẫu cũ trước khi có phiếu Phụ lục II.' : '',
          exam: spec.legacy ? null : seedExam(ch, n, spec, { headApplies, doctor: spec.campaign === 'c2_oct' ? DOCTOR_C2 : DOCTOR }),
          examStatus: spec.legacy ? null : concluded ? 'CONCLUDED' : 'DRAFT',
          concludedAt: concluded ? `${date}T09:30:00.000Z` : null,
          campaignId: campaign.id,
          measuredBy: teacherId,
          // Phiếu đã kết luận có người đi cùng tự công bố khi lưu (user chốt 2026-10-17).
          published: concluded && !spec.noCompanion,
          publishedAt: concluded && !spec.noCompanion ? `${date}T09:30:00.000Z` : null,
          autoPublished: concluded && !spec.noCompanion,
          createdAt: `${date}T08:30:00.000Z`,
          // Phiếu đã sửa sau khi kết luận: lịch sử có lý do, giá trị cũ và mới.
          edits: spec.edited
            ? [
                {
                  at: `${date}T10:15:00.000Z`,
                  userId: teacherId,
                  reason: spec.edited.reason,
                  changes: [{ field: 'weightKg', label: 'Cân nặng (kg)', from: round1(weightKg + spec.edited.weightFrom), to: weightKg }],
                },
              ]
            : [],
        });
      }
    });
  return list;
};

/*
 * Hành chính, tiền sử hỏi khi tiếp nhận (dữ liệu giả). Trẻ khác để "Chưa cung cấp" như trẻ tiếp nhận từ trước (quyết định 5).
 * ch_007: đủ hồ sơ, chưa khám đợt này ⇒ phiếu điền sẵn từ hồ sơ. ch_009: hồ sơ thiếu, khai có tiếp xúc người bệnh lao.
 * ch_new_1: chờ xếp lớp, khai đủ.
 */
const address = (street, ward) => ({ province: 'Hải Phòng', ward, street });
export const SEED_CHILD_PROFILES = {
  ch_007: {
    profile: {
      idNumber: '999222009007',
      premature: 'YES',
      gestationWeeks: 35,
      ethnicity: 'Kinh',
      beneficiary: 'Trẻ em dưới 6 tuổi',
      paymentSource: 'BHYT',
      bloodType: 'A',
      address: address('Số 12 ngõ 5', 'Phường Thượng Hồng'),
    },
    medicalHistory: {
      self: { state: 'REPORTED', text: 'Hen phế quản' },
      family: { state: 'NONE_REPORTED', text: '' },
      tbContact: { state: 'NONE_REPORTED' },
    },
  },
  ch_009: {
    profile: { ethnicity: 'Kinh', bloodType: 'O' },
    medicalHistory: {
      self: { state: 'NONE_REPORTED', text: '' },
      family: { state: 'NOT_PROVIDED', text: '' },
      tbContact: { state: 'REPORTED', contactDate: '2026-07-28' },
    },
  },
  // Vấn đề đã biết: ch_023 khám đợt này chọn "đã biết"; ch_031 đóng phiếu với kết quả chuyên khoa xác định có vấn đề.
  ch_023: {
    medicalHistory: {
      self: { state: 'REPORTED', text: 'Cận thị – đeo kính' },
      family: { state: 'NOT_PROVIDED', text: '' },
      tbContact: { state: 'NONE_REPORTED' },
    },
  },
  ch_031: {
    medicalHistory: {
      self: { state: 'REPORTED', text: 'Bàn chân bẹt – mang giày chỉnh hình' },
      family: { state: 'NOT_PROVIDED', text: '' },
      tbContact: { state: 'NONE_REPORTED' },
    },
  },
  ch_new_1: {
    profile: {
      idNumber: '999222009901',
      premature: 'NO',
      gestationWeeks: null,
      ethnicity: 'Kinh',
      beneficiary: 'Trẻ em dưới 6 tuổi',
      paymentSource: 'BHYT',
      bloodType: 'B',
      address: address('Thôn Đông', 'Xã Hồng Phong'),
    },
    medicalHistory: {
      self: { state: 'NONE_REPORTED', text: '' },
      family: { state: 'NONE_REPORTED', text: '' },
      tbContact: { state: 'NONE_REPORTED' },
    },
  },
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
    ...(SEED_CHILD_PROFILES[ch.id] && { medicalHistory: SEED_CHILD_PROFILES[ch.id].medicalHistory }),
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
          idNumber: g.idNumber || '',
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
