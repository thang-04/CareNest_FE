import { durationRangeIssue, isWholeWeekTheme, overlappingThemes } from '@/models/education-plan/goalTable';

const rangeOf = (t) => ({ ...t, start: t.startDate, end: t.endDate });

export const branchDateIssues = (template, templates, breaks = [], limits = null) => {
  const range = rangeOf(template);
  if (!range.start || !range.end) return [];
  if (range.end < range.start) return ['Ngày kết thúc trước ngày bắt đầu.'];
  const issues = [];
  if (!isWholeWeekTheme(range)) issues.push('Bắt đầu Thứ 2, kết thúc Thứ 6.');
  const duration = durationRangeIssue(range, breaks, limits, 'Nhánh');
  if (duration) issues.push(duration);
  const siblings = templates.filter((t) => String(t.themeId) === String(template.themeId)).map(rangeOf);
  const overlaps = overlappingThemes(range, siblings);
  if (overlaps.length) issues.push(`Trùng thời gian với ${overlaps.map((t) => `nhánh "${t.name || 'chưa đặt tên'}"`).join(', ')}.`);
  return issues;
};

export const branchScheduleIssue = (templates = [], breaks = [], limits = null) => {
  for (const template of templates) {
    const issues = branchDateIssues(template, templates, breaks, limits);
    if (issues.length) return `Nhánh "${template.name || 'chưa đặt tên'}": ${issues[0]}`;
  }
  return null;
};
