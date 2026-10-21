import { ApiError } from '@/mocks/mockDatabase';
import { EMOTION_LABELS, HEALTH_STATUS, PERIOD_TYPE } from '@/models/assessment/assessmentConstants';
import { periodLabel } from '@/utils/assessment/assessmentPeriods';
import { MEAL_SESSION_LABELS } from '@/models/attendance/attendanceConstants';
import { BEHAVIORS, NAP_LABELS, PARTICIPATION_LABELS, POSITIVE_BEHAVIORS } from '@/models/assessment/dailyObservationOptions';
import { TEMPERATURE_LEVELS } from '@/utils/attendance/temperatureLevels';
import { HEALTH_ACTIONS, HEALTH_SYMPTOMS } from '@/utils/dailyHealthValidation';

/*
 * Fake "AI evaluation service" (UC 4.7). The real backend calls the external AI service; this mock writes
 * a neutral, template-based draft from the source records. Wording avoids diagnostic terms (GBR-OBS-05)
 * and never treats missing observations as a failed objective.
 */

const givenName = (fullName) =>
  String(fullName || '')
    .split(' ')
    .slice(-2)
    .join(' ');

const countBy = (list, key) =>
  list.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});

const top = (counts) => Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

export const summarizeSources = ({ assessments, presentDays, criteria, monthlyEvaluations = [] }) => {
  const criteriaCounts = Object.fromEntries(criteria.map((c) => [c.id, 0]));
  assessments.forEach((a) => a.criteriaMet.forEach((id) => (criteriaCounts[id] = (criteriaCounts[id] || 0) + 1)));
  return {
    assessmentCount: assessments.length,
    presentDays,
    flagCount: assessments.filter((a) => a.flag).length,
    criteriaCounts,
    activities: [...new Set(assessments.map((a) => a.activity))],
    monthlyCount: monthlyEvaluations.length,
  };
};

/** Mục tiêu đạt / cần hỗ trợ trong kỳ (tên ngắn, vd. MT12) từ bảng đếm theo mục tiêu. */
const goalSplit = (st) => {
  const goals = Object.entries(st?.goals?.byGoal || {});
  return {
    met: goals.filter(([, c]) => c.dat > 0 && c.dat >= c.chuaDat).map(([g]) => g.split(' – ')[0]),
    notYet: goals.filter(([, c]) => c.chuaDat > c.dat).map(([g]) => g.split(' – ')[0]),
  };
};

const listCounts = (counts, labels) =>
  Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${(labels[k] || k).toLowerCase()} ${n}`)
    .join(', ');

/**
 * Bảng số liệu đếm từ ô tích (đầu vào duy nhất gửi AI cùng mục tiêu / chủ đề của giáo án). Câu chữ chỉ mô tả
 * số lần quan sát, không kết luận về sức khỏe.
 */
export const structuredLines = (st) => {
  if (!st?.observedDays) return [];
  const lines = [];
  const h = st.health;
  if (h.days) {
    const signs = listCounts(h.signDays, HEALTH_SYMPTOMS);
    const fever = listCounts(h.feverDays, Object.fromEntries(TEMPERATURE_LEVELS.map((l) => [l.key, l.label])));
    lines.push(
      h.normalDays === h.days
        ? `Sức khỏe: ${h.days} ngày cô ghi nhận bé bình thường.`
        : `Sức khỏe: ${h.normalDays}/${h.days} ngày bình thường${signs ? `; biểu hiện ${signs} ngày` : ''}${fever ? `; thân nhiệt khi khám ${fever} ngày` : ''}. Gia đình theo dõi thêm ở nhà.`,
    );
  }
  const acted = listCounts(
    Object.fromEntries(['MEDICAL_ROOM', 'EARLY_PICKUP', 'REFERRAL'].map((a) => [a, h.actionDays?.[a] || 0])),
    HEALTH_ACTIONS,
  );
  if (acted) lines.push(`Xử trí sức khỏe trong kỳ: ${acted} ngày.`);
  const meals = Object.entries(st.meals)
    .map(([m, c]) =>
      c.AN_IT || c.KHONG_AN
        ? `${(MEAL_SESSION_LABELS[m] || m).toLowerCase()} ${[c.AN_IT && `ăn ít ${c.AN_IT}`, c.KHONG_AN && `không ăn ${c.KHONG_AN}`].filter(Boolean).join(', ')} ngày`
        : '',
    )
    .filter(Boolean);
  lines.push(meals.length ? `Ăn: ${meals.join('; ')}.` : 'Ăn: bé ăn hết suất ở các bữa đã ghi nhận.');
  const napIssue = (st.nap.NGU_IT || 0) + (st.nap.KHONG_NGU || 0);
  lines.push(
    napIssue
      ? `Ngủ trưa: ${listCounts({ NGU_IT: st.nap.NGU_IT || 0, KHONG_NGU: st.nap.KHONG_NGU || 0 }, NAP_LABELS)} ngày.`
      : 'Ngủ trưa: bé ngủ tốt.',
  );
  const good = listCounts(Object.fromEntries(POSITIVE_BEHAVIORS.map((b) => [b, st.behaviors[b] || 0])), BEHAVIORS);
  const concern = listCounts(Object.fromEntries(Object.entries(st.behaviors).filter(([b]) => !POSITIVE_BEHAVIORS.includes(b))), BEHAVIORS);
  if (good || concern)
    lines.push(`Hành vi: ${[good && `tích cực – ${good}`, concern && `cần lưu ý – ${concern}`].filter(Boolean).join('; ')} lượt.`);
  const part = listCounts(st.participation, PARTICIPATION_LABELS);
  if (part) lines.push(`Tham gia hoạt động theo giáo án: ${part} lượt.`);
  return lines;
};

/**
 * Bản nháp theo dữ liệu 3 nhóm của đánh giá hằng ngày: mục tiêu (kiến thức, kỹ năng), cảm xúc, sức khỏe, ăn, ngủ,
 * hành vi; gợi ý phối hợp gia đình theo đúng điểm cần hỗ trợ của kỳ.
 */
const structuredDraft = ({ name, label, presentDays, st, plan = {} }) => {
  const { met, notYet } = goalSplit(st);
  const mood = EMOTION_LABELS[top(st.emotion)] || 'Bình thường';
  const when = plan.weekNo
    ? `tuần ${plan.weekNo} (${label.replace(/^tuần /, '')})${plan.themeName ? `, chủ đề "${plan.themeName}"` : ''}`
    : label;
  const lines = [`Trong ${when}, bé ${name} đi học ${presentDays} ngày, cô đánh giá hằng ngày ${st.observedDays} ngày.`];
  // Chỉ xét mục tiêu giáo án đã đưa vào hoạt động của kỳ; mục tiêu chưa dạy không tính là cần hỗ trợ
  if (plan.offered) lines.push(`Giáo án của kỳ có ${plan.offered} mục tiêu được đánh giá qua các hoạt động.`);
  if (met.length) lines.push(`Kiến thức, kỹ năng: bé đạt ${met.join(', ')}.`);
  if (notYet.length) lines.push(`Cần tiếp tục hỗ trợ: ${notYet.join(', ')} – cô tạo thêm cơ hội để bé luyện tập trong các hoạt động.`);
  if (!met.length && !notYet.length) lines.push('Kiến thức, kỹ năng: kỳ này chưa có mục tiêu giáo án được đánh giá.');
  lines.push(`Cảm xúc: phần lớn thời gian bé ${mood.toLowerCase()}.`);
  lines.push(...structuredLines(st));
  const tips = [];
  if (notYet.length) tips.push('cùng bé ôn lại các nội dung cần hỗ trợ ở trên');
  const mealIssue = Object.values(st.meals).some((c) => c.AN_IT || c.KHONG_AN);
  if (mealIssue) tips.push('khuyến khích bé ăn đủ bữa');
  if ((st.nap.NGU_IT || 0) + (st.nap.KHONG_NGU || 0)) tips.push('cho bé ngủ đủ giấc buổi tối');
  tips.push('khen ngợi khi bé cố gắng');
  lines.push(`Gợi ý phối hợp với gia đình: ${tips.join(', ')}.`);
  return lines;
};

/** Returns { content, source }. Throws 422 (MSG32) when the period has no source records. */
export const generateEvaluationDraft = ({
  child,
  plan,
  structured,
  periodType,
  start,
  end,
  assessments,
  presentDays,
  criteria,
  monthlyEvaluations = [],
}) => {
  const source = { ...summarizeSources({ assessments, presentDays, criteria, monthlyEvaluations }), structured: structured || null };
  if (!assessments.length && !monthlyEvaluations.length) {
    throw new ApiError(422, 'Thiếu dữ liệu nguồn cho kỳ này. Hãy xem lại các đánh giá hằng ngày đã ghi nhận.', { source });
  }
  const name = givenName(child.fullName);
  const label = periodType === PERIOD_TYPE.YEAR ? 'năm học vừa qua' : periodLabel(periodType, start, end).toLowerCase();
  // Kỳ có đánh giá hằng ngày theo 3 nhóm: tổng hợp từ số liệu đó; bản ghi cũ dùng cách tổng hợp theo tiêu chí
  if (periodType !== PERIOD_TYPE.YEAR && structured?.observedDays) {
    return { content: structuredDraft({ name, label, presentDays, st: structured, plan }).join('\n'), source };
  }
  const ranked = criteria
    .map((c) => ({ c, n: source.criteriaCounts[c.id] || 0 }))
    .filter((x) => x.c.active)
    .sort((a, b) => b.n - a.n);
  const strengths = ranked.slice(0, 3).filter((x) => x.n > 0);
  const growth = ranked.slice(-2).filter((x) => source.assessmentCount && x.n / source.assessmentCount < 0.75);
  const mood = EMOTION_LABELS[top(countBy(assessments, 'emotion'))] || 'Bình thường';
  const tiredDays = assessments.filter((a) => a.healthStatus !== HEALTH_STATUS.GOOD).length;

  const lines = [];
  lines.push(
    `Trong ${label}, bé ${name} đi học ${presentDays} ngày, được giáo viên ghi nhận ${source.assessmentCount} lượt đánh giá và nhận ${source.flagCount} cờ bé ngoan.`,
  );
  if (periodType === PERIOD_TYPE.YEAR && monthlyEvaluations.length) {
    lines.push(`Bản nháp tổng hợp từ ${monthlyEvaluations.length} đánh giá tháng đã được giáo viên xác nhận.`);
  }
  if (strengths.length) {
    lines.push(`Điểm nổi bật: bé ${strengths.map((x) => x.c.name.toLowerCase()).join(', ')}.`);
  }
  if (growth.length) {
    lines.push(
      `Nội dung cần tiếp tục hỗ trợ: ${growth.map((x) => x.c.name.toLowerCase()).join(', ')} – giáo viên sẽ tạo thêm cơ hội để bé luyện tập trong các hoạt động.`,
    );
  }
  const detail = structuredLines(structured);
  lines.push(
    `Cảm xúc: phần lớn thời gian bé ${mood.toLowerCase()}${!detail.length && tiredDays ? `; có ${tiredDays} lượt cô ghi nhận bé hơi mệt hoặc không khỏe` : ''}.`,
  );
  lines.push(...detail);
  lines.push('Gợi ý phối hợp với gia đình: trò chuyện với bé về các hoạt động ở lớp và khen ngợi khi bé cố gắng.');
  return { content: lines.join('\n'), source };
};
