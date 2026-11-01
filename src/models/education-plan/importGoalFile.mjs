import { getImportGoals, mergeImportedGoals } from '@/models/education-plan/importGoals.mjs';

/*
 * Nhập file bảng mục tiêu (BE:EDU-46): BE trả bản xem trước; Web ghép bằng luật bổ sung của EDU-24 (thêm cuối lĩnh vực
 * cùng tên, bỏ mục tiêu trùng câu, giữ lĩnh vực con/nhóm) và giữ dấu tích khớp viết tắt chủ đề đang có.
 */

/** Bản xem trước dựng thành kế hoạch nguồn như mergeImportedGoals cần. */
export const fileAsSourcePlan = (preview) => ({
  id: 'file',
  domains: (preview?.domains || []).map((d, i) => ({
    id: `file-d${i}`,
    name: d.name,
    rows: (d.rows || []).map((r, k) => ({
      id: `file-${i}-${k}`,
      kind: r.kind,
      text: r.text,
      ...(r.kind === 'goal'
        ? { contents: (r.contents || []).map((c, j) => ({ id: `file-${i}-${k}-${j}`, text: c.text, themes: c.themes || [] })) }
        : {}),
    })),
  })),
});

const abbrKey = (abbr) => (abbr || '').trim().toLowerCase();

/** Đếm theo lĩnh vực để hiện xem trước: số mục tiêu, nội dung, dấu tích. */
export const previewSummary = (preview) =>
  (preview?.domains || []).map((d) => {
    const goals = (d.rows || []).filter((r) => r.kind === 'goal');
    const contents = goals.flatMap((g) => g.contents || []);
    return { name: d.name, goals: goals.length, contents: contents.length, ticks: contents.reduce((n, c) => n + (c.themes || []).length, 0) };
  });

/** Viết tắt chủ đề trong file chưa có ở bản đang soạn (không phân biệt hoa thường). */
export const missingThemeAbbrs = (preview, themes) => {
  const have = new Set((themes || []).map((t) => abbrKey(t.abbr)));
  const used = (preview?.domains || []).flatMap((d) => (d.rows || []).flatMap((r) => (r.contents || []).flatMap((c) => c.themes || [])));
  const missing = new Map();
  used.filter((a) => !have.has(abbrKey(a))).forEach((a) => missing.has(abbrKey(a)) || missing.set(abbrKey(a), a.trim()));
  return [...missing.values()];
};

export function mergeFileGoals(form, preview, makeId) {
  const ids = new Map((form.themes || []).map((t) => [abbrKey(t.abbr), t.id]));
  let ticks = 0;
  const themesOf = (content) =>
    (content.themes || []).flatMap((abbr) => {
      const id = ids.get(abbrKey(abbr));
      if (!id) return [];
      ticks += 1;
      return [id];
    });
  const source = fileAsSourcePlan(preview);
  const goalIds = getImportGoals(source).map((g) => g.id);
  const { domains, report } = mergeImportedGoals(form, source, goalIds, makeId, { themesOf, freeContext: true });
  return { domains, report: { ...report, ticks, missingThemes: missingThemeAbbrs(preview, form.themes) } };
}
