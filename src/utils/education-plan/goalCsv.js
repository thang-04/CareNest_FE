import { downloadCsv } from '@/utils/exportCsv';
import { parseCsv } from '@/services/children/mock/enrollmentImport';
import { DOMAINS, DOMAIN_PREFIX } from '@/models/education-plan/educationPlanConstants';
import { HEADING_LABEL } from '@/models/education-plan/goalTable';

export const GOAL_CSV_HEADER = ['Lĩnh vực', 'Loại dòng', 'STT', 'Mục tiêu', 'Nội dung giáo dục', 'Chủ đề (viết tắt, cách nhau bởi ;)'];
const GOAL_KIND = 'Mục tiêu';

/**
 * Xuất bảng mục tiêu ra CSV theo đúng thứ tự trên bảng: dòng lĩnh vực con / nhóm kết quả, rồi mỗi nội dung một dòng
 * (mục tiêu chưa có nội dung vẫn có một dòng). Cột chủ đề ghi tên viết tắt của các chủ đề được tích.
 */
export function exportGoalsCsv(domains, numbers, themes, filename) {
  const abbr = Object.fromEntries(themes.map((t) => [t.id, t.abbr || t.name]));
  const rows = [GOAL_CSV_HEADER];
  domains.forEach((d) =>
    d.rows.forEach((r) => {
      if (r.kind !== 'goal') {
        if (r.text.trim()) rows.push([d.name, HEADING_LABEL[r.kind], '', r.text, '', '']);
        return;
      }
      if (!r.text.trim()) return;
      const contents = r.contents.filter((c) => c.text.trim());
      const no = `MT${numbers[r.id]}`;
      if (!contents.length) rows.push([d.name, GOAL_KIND, no, r.text, '', '']);
      contents.forEach((c) =>
        rows.push([
          d.name,
          GOAL_KIND,
          no,
          r.text,
          c.text,
          c.themes
            .map((t) => abbr[t])
            .filter(Boolean)
            .join('; '),
        ]),
      );
    }),
  );
  downloadCsv(rows, filename);
}

const norm = (s) => (s || '').trim().toLowerCase();
const domainOf = (name) =>
  DOMAINS.find((d) => norm(d) === norm(name) || norm(DOMAIN_PREFIX[d]) === norm(name) || (norm(name) && norm(d).includes(norm(name))));
const kindOf = (label) => Object.keys(HEADING_LABEL).find((k) => norm(HEADING_LABEL[k]) === norm(label)) || 'goal';

/**
 * Đọc CSV theo mẫu xuất ở trên. Trả về [{ domain, rows: [{ kind, text, contents: [{ text, themes: [viết tắt] }] }] }]
 * và số dòng bị bỏ qua. Các dòng liền nhau cùng câu mục tiêu là các nội dung của cùng một mục tiêu.
 */
export function parseGoalsCsv(text) {
  const table = parseCsv(text).filter((r) => r.some((c) => (c || '').trim()));
  const [, ...body] = table;
  const out = new Map();
  let skipped = 0;
  body.forEach(([domainName, kindLabel, , goalText, contentText, themeText]) => {
    const domain = domainOf(domainName);
    if (!domain || !(goalText || '').trim()) {
      skipped++;
      return;
    }
    const rows = out.get(domain) || [];
    const kind = kindOf(kindLabel);
    if (kind !== 'goal') rows.push({ kind, text: goalText.trim() });
    else {
      const last = rows[rows.length - 1];
      const same = last && last.kind === 'goal' && norm(last.text) === norm(goalText);
      const goal = same ? last : { kind, text: goalText.trim(), contents: [] };
      if (goal !== last) rows.push(goal);
      if ((contentText || '').trim()) {
        const themes = (themeText || '')
          .split(/[;,]/)
          .map((t) => t.trim())
          .filter(Boolean);
        goal.contents.push({ text: contentText.trim(), themes });
      }
    }
    out.set(domain, rows);
  });
  return { domains: [...out].map(([domain, rows]) => ({ domain, rows })), skipped };
}
