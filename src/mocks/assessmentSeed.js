/*
 * Fictional assessment data (no real child data). Built relative to "today" so the demo always has
 * about three finished school weeks of daily assessments. Collections seeded lazily by
 * services/assessment/mock/assessmentMockRepository.js:
 *   db.assessmentCriteria, db.dailyAssessments, db.yearEndEvaluations (shells), db.rewardProposals.
 * Weekly / monthly evaluations and good behaviour tickets are produced by the repository's period jobs.
 */
import { DEFAULT_CRITERIA, EMOTION, HEALTH_STATUS, REWARD_STATUS } from '@/models/assessment/assessmentConstants';
import { addDays, schoolDaysBetween, schoolYearOf, weekStart } from '@/utils/assessment/assessmentPeriods';

const COMMENTS = [
  'Bé hăng hái giơ tay trả lời câu hỏi của cô.',
  'Bé chơi đoàn kết, biết nhường đồ chơi cho bạn.',
  'Bé còn rụt rè khi kể chuyện trước lớp.',
  'Bé tự cất gối và dép đúng nơi quy định.',
  'Bé thích vẽ, tô màu đẹp và gọn gàng.',
  '',
  '',
  '',
];

const ACTIVITY = 'Hoạt động học';

// Classes that already reached the (simulated) end of the school year for the demo.
const YEAR_END_DEMO = {
  cls_c1_c2: ['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'AWAITING_REVIEW'],
  cls_c1_m1: ['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'AWAITING_REVIEW', 'AWAITING_REVIEW', 'AWAITING_REVIEW'],
  cls_c2_la: ['AWAITING_REVIEW', 'AWAITING_REVIEW', 'AWAITING_REVIEW', 'AWAITING_REVIEW', 'AI_FAILED', 'AWAITING_REVIEW'],
};

const buildDailyAssessments = (classes, children, today) => {
  const from = weekStart(addDays(today, -21));
  const days = schoolDaysBetween(from, addDays(today, -1));
  const records = [];
  classes.forEach((cls) => {
    const kids = children.filter((ch) => ch.classId === cls.id && ch.status === 'ACTIVE');
    days.forEach((date, di) => {
      kids.forEach((ch, ci) => {
        if ((di * 7 + ci * 3) % 19 === 0) return; // absent that day
        const k = di * 3 + ci * 5;
        // The fifth child of each class earns fewer flags so the ticket list shows ineligible children too.
        const flag = k % 10 < (ci === 4 ? 4 : 8);
        records.push({
          id: `da_${date.replace(/-/g, '')}_${ch.id}`,
          date,
          classId: cls.id,
          campusId: cls.campusId,
          childId: ch.id,
          activity: ACTIVITY,
          healthStatus: k % 13 === 0 ? HEALTH_STATUS.TIRED : HEALTH_STATUS.GOOD,
          emotion: k % 11 === 0 ? EMOTION.SAD : k % 4 === 0 ? EMOTION.CALM : EMOTION.HAPPY,
          criteriaMet: DEFAULT_CRITERIA.filter((_, j) => (di + ci + j * 3) % 4 !== 0).map((c) => c.id),
          flag,
          comment: COMMENTS[k % COMMENTS.length],
          recordedBy: cls.homeroomTeacherId,
          recordedAt: new Date(`${date}T10:30:00+07:00`).toISOString(),
          updatedAt: null,
          corrections: [],
          parentNotifiedAt: new Date(`${date}T10:30:00+07:00`).toISOString(),
        });
      });
    });
  });
  return records;
};

const buildYearEndShells = (classes, children, schoolYear) =>
  Object.entries(YEAR_END_DEMO).flatMap(([classId, statuses]) => {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) return [];
    return children
      .filter((ch) => ch.classId === classId && ch.status === 'ACTIVE')
      .slice(0, statuses.length)
      .map((ch, i) => ({ id: `ye_${schoolYear}_${ch.id}`, childId: ch.id, classId, campusId: cls.campusId, seedStatus: statuses[i] }));
  });

const buildRewardProposals = (classes, children, schoolYear) => {
  const kid = (classId, i) => children.filter((ch) => ch.classId === classId && ch.status === 'ACTIVE')[i];
  const at = (d, h = '09:00') => new Date(`${d}T${h}:00+07:00`).toISOString();
  const base = '2026-10-01';
  const specs = [
    { classId: 'cls_c1_c2', i: 0, title: 'Bé ngoan toàn diện', status: REWARD_STATUS.APPROVED, by: 'u_mai' },
    { classId: 'cls_c1_c2', i: 1, title: 'Bé chăm ngoan, học giỏi', status: REWARD_STATUS.PENDING_PRINCIPAL, by: 'u_mai' },
    { classId: 'cls_c1_c2', i: 2, title: 'Bé tích cực tham gia hoạt động', status: REWARD_STATUS.PENDING_VP, by: 'u_ha' },
    { classId: 'cls_c1_c2', i: 3, title: 'Bé lễ phép, hòa đồng', status: REWARD_STATUS.RETURNED, by: 'u_mai' },
    { classId: 'cls_c1_c2', i: 4, title: 'Bé có năng khiếu nghệ thuật', status: REWARD_STATUS.DRAFT, by: 'u_mai' },
    { classId: 'cls_c1_m1', i: 0, title: 'Bé ngoan toàn diện', status: REWARD_STATUS.PENDING_VP, by: 'u_an' },
    { classId: 'cls_c1_m1', i: 1, title: 'Bé khỏe – Bé đẹp', status: REWARD_STATUS.REJECTED, by: 'u_an' },
  ];
  return specs
    .map((s, n) => {
      const child = kid(s.classId, s.i);
      const cls = classes.find((c) => c.id === s.classId);
      if (!child || !cls) return null;
      const history = [{ id: `rh_${n}_1`, action: 'CREATED', userId: s.by, at: at(base) }];
      const p = {
        id: `rp_seed_${n + 1}`,
        code: `KT${schoolYear.slice(2, 4)}-${String(n + 1).padStart(3, '0')}`,
        schoolYear,
        childId: child.id,
        classId: cls.id,
        campusId: cls.campusId,
        rewardTitle: s.title,
        reason: `${child.fullName} đạt kết quả tốt trong đánh giá cuối năm: tham gia tích cực các hoạt động, nhận nhiều phiếu bé ngoan và được nhận xét tiến bộ rõ ở các lĩnh vực phát triển.`,
        status: s.status,
        createdBy: s.by,
        createdAt: at(base),
        submittedAt: null,
        vpReview: null,
        principalDecision: null,
        approvedAt: null,
        approvedBy: null,
        history,
      };
      if (s.status === REWARD_STATUS.DRAFT) return p;
      p.submittedAt = at('2026-10-02');
      history.push({ id: `rh_${n}_2`, action: 'SUBMITTED', userId: s.by, at: p.submittedAt });
      if (s.status === REWARD_STATUS.PENDING_VP) return p;
      const vpBy = cls.campusId === 'c1' ? 'u_lan' : 'u_duc';
      if (s.status === REWARD_STATUS.RETURNED) {
        p.vpReview = { by: vpBy, at: at('2026-10-03'), decision: 'RETURN', comment: 'Bổ sung minh chứng từ đánh giá cuối năm của trẻ.' };
        history.push({ id: `rh_${n}_3`, action: 'RETURNED', userId: vpBy, at: p.vpReview.at, note: p.vpReview.comment });
        return p;
      }
      p.vpReview = { by: vpBy, at: at('2026-10-03'), decision: 'FORWARD', comment: 'Đề xuất phù hợp, chuyển Hiệu trưởng.' };
      history.push({ id: `rh_${n}_3`, action: 'FORWARDED', userId: vpBy, at: p.vpReview.at, note: p.vpReview.comment });
      if (s.status === REWARD_STATUS.PENDING_PRINCIPAL) return p;
      const approved = s.status === REWARD_STATUS.APPROVED;
      p.principalDecision = {
        by: 'u_hung',
        at: at('2026-10-05'),
        decision: approved ? 'APPROVE' : 'REJECT',
        comment: approved ? 'Đồng ý khen thưởng.' : 'Danh hiệu chưa phù hợp với kết quả đánh giá sức khỏe cuối năm.',
      };
      if (approved) {
        p.approvedAt = p.principalDecision.at;
        p.approvedBy = 'u_hung';
      }
      history.push({
        id: `rh_${n}_4`,
        action: approved ? 'APPROVED' : 'REJECTED',
        userId: 'u_hung',
        at: p.principalDecision.at,
        note: p.principalDecision.comment,
      });
      return p;
    })
    .filter(Boolean);
};

export const buildAssessmentSeed = ({ classes, children, today }) => {
  const schoolYear = schoolYearOf(today);
  return {
    assessmentCriteria: DEFAULT_CRITERIA,
    dailyAssessments: buildDailyAssessments(classes, children, today),
    yearEndShells: buildYearEndShells(classes, children, schoolYear),
    rewardProposals: buildRewardProposals(classes, children, schoolYear),
    schoolYear,
  };
};
