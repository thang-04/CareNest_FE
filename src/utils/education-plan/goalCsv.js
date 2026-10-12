import { downloadCsv } from '@/utils/exportCsv';
import { parseCsv } from '@/services/children/mock/enrollmentImport';
import { DOMAINS, DOMAIN_PREFIX } from '@/models/education-plan/educationPlanConstants';

export const GOAL_CSV_HEADER = ['Lĩnh vực', 'Mã lĩnh vực', 'Mã mục tiêu', 'Mục tiêu', 'Mã YCCĐ', 'Yêu cầu cần đạt'];

/** Xuất bộ mục tiêu (đã đánh số MT) ra CSV: mỗi YCCĐ một dòng; mục tiêu chưa có YCCĐ vẫn có một dòng. */
export function exportGoalsCsv(domains, filename) {
  const rows = [GOAL_CSV_HEADER];
  domains.forEach((d) =>
    d.items
      .filter((it) => it.text.trim())
      .forEach((it) => {
        const reqs = it.requirements.filter((r) => r.text.trim());
        if (!reqs.length) rows.push([d.name, DOMAIN_PREFIX[d.name] || '', it.code, it.text, '', '']);
        reqs.forEach((r) => rows.push([d.name, DOMAIN_PREFIX[d.name] || '', it.code, it.text, r.code, r.text]));
      }),
  );
  downloadCsv(rows, filename);
}

const norm = (s) => (s || '').trim().toLowerCase();
const domainOf = (name, prefix) =>
  DOMAINS.find((d) => norm(d) === norm(name) || norm(DOMAIN_PREFIX[d]) === norm(prefix) || (norm(d).includes(norm(name)) && norm(name)));

/**
 * Đọc CSV theo mẫu xuất ở trên. Trả về [{ domain, goals: [{ text, requirements: [text] }] }] và số dòng bị bỏ qua.
 * Mã trong file không được dùng: hệ thống tự cấp mã khi ghép vào form.
 */
export function parseGoalsCsv(text) {
  const table = parseCsv(text).filter((r) => r.some((c) => (c || '').trim()));
  const [, ...body] = table;
  const out = new Map();
  let skipped = 0;
  body.forEach(([domainName, prefix, , goalText, , reqText]) => {
    const domain = domainOf(domainName, prefix);
    if (!domain || !(goalText || '').trim()) {
      skipped++;
      return;
    }
    const goals = out.get(domain) || [];
    let goal = goals.find((g) => norm(g.text) === norm(goalText));
    if (!goal) {
      goal = { text: goalText.trim(), requirements: [] };
      goals.push(goal);
    }
    if ((reqText || '').trim() && !goal.requirements.some((r) => norm(r) === norm(reqText))) goal.requirements.push(reqText.trim());
    out.set(domain, goals);
  });
  return { domains: [...out].map(([domain, goals]) => ({ domain, goals })), skipped };
}
