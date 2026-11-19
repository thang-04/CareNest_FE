import { themeGapIssue } from './goalTable.js';

// EDU-66/69/71: hỗ trợ người soạn; backend vẫn quyết định gửi duyệt.
export function submissionRequirementsIssue(plan) {
  const annual = (plan.planType || plan.planLevel) === 'SCHOOL_YEAR';
  const themes = plan.themes || [];
  const goals = (plan.domains || []).flatMap((domain) => (domain.rows || []).filter((row) => row.kind === 'goal' && row.text?.trim()));
  if (annual) {
    const named = themes.filter((theme) => theme.name?.trim() && theme.abbr?.trim()).length;
    if (named < 9) return 'Cần tối thiểu 9 chủ đề.';
    const missing = themes.find((theme) => !theme.start || !theme.end);
    if (missing) return `Chủ đề "${missing.name || missing.abbr}" cần đủ ngày bắt đầu và kết thúc.`;
    const gap = themeGapIssue(themes, plan.breaks || []);
    if (gap) return gap;
    const branch = (plan.branchTemplates || []).find((item) => !item.startDate || !item.endDate);
    if (branch) return `Nhánh "${branch.name || ''}" cần đủ ngày bắt đầu và kết thúc.`;
    const empty = goals.filter((goal) => !(goal.contents || []).some((content) => content.text?.trim()));
    if (empty.length)
      return empty.length === 1
        ? `Mục tiêu "${empty[0].text}" cần ít nhất một nội dung.`
        : `Còn ${empty.length} mục tiêu chưa có nội dung, đầu tiên: "${empty[0].text}".`;
    const hasChain = (plan.domains || []).some((domain) => {
      let group = false;
      return (domain.rows || []).some((row) => {
        if (row.kind === 'sub') group = false;
        if (row.kind === 'group') group = !!row.text?.trim();
        return group && row.kind === 'goal' && row.text?.trim() && (row.contents || []).some((content) => content.text?.trim());
      });
    });
    if (!hasChain) return 'Cần ít nhất một nhóm kết quả có mục tiêu và nội dung.';
  } else {
    const valid = new Set(themes.filter((theme) => theme.name?.trim() && theme.start && theme.end && theme.end >= theme.start).map((theme) => String(theme.id)));
    const missing = goals.find((goal) => !(goal.contents || []).some((content) => (content.themes || []).some((id) => valid.has(String(id)))));
    if (missing) return `Mục tiêu "${missing.text}" cần chọn nội dung vào ít nhất một chủ đề.`;
  }
  return null;
}
