import { ApiError } from '@/mocks/mockDatabase';
import { EMOTION_LABELS, HEALTH_STATUS, PERIOD_TYPE } from '@/models/assessment/assessmentConstants';
import { periodLabel } from '@/utils/assessment/assessmentPeriods';

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

/** Returns { content, source }. Throws 422 (MSG32) when the period has no source records. */
export const generateEvaluationDraft = ({ child, periodType, start, end, assessments, presentDays, criteria, monthlyEvaluations = [] }) => {
  const source = summarizeSources({ assessments, presentDays, criteria, monthlyEvaluations });
  if (!assessments.length && !monthlyEvaluations.length) {
    throw new ApiError(422, 'Thiếu dữ liệu nguồn cho kỳ này. Hãy xem lại các đánh giá hằng ngày đã ghi nhận.', { source });
  }
  const name = givenName(child.fullName);
  const label = periodType === PERIOD_TYPE.YEAR ? 'năm học vừa qua' : periodLabel(periodType, start, end).toLowerCase();
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
  lines.push(
    `Cảm xúc: phần lớn thời gian bé ${mood.toLowerCase()}${tiredDays ? `; có ${tiredDays} lượt cô ghi nhận bé hơi mệt hoặc không khỏe` : ''}.`,
  );
  lines.push('Gợi ý phối hợp với gia đình: trò chuyện với bé về các hoạt động ở lớp và khen ngợi khi bé cố gắng.');
  return { content: lines.join('\n'), source };
};
