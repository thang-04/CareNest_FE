// BE:EDU-104 "Lấy tick từ năm trước" ở kế hoạch tổ: ghép chủ đề năm trước ↔ năm nay, ghép nội dung theo chữ trong cùng
// lĩnh vực, trả groups cùng dạng aiThemeContent.groupMatches để áp dụng bằng applyPicked (chỉ thêm tick).
import { plainText } from './aiThemeContent.mjs';

/** Chữ để so: bỏ dấu, hoa thường, gộp khoảng trắng, bỏ dấu câu cuối. */
export const normalizeContent = (s) => plainText(s).replace(/[\s.,;:!?…]+$/u, '');

const domainKey = (id) => String(id ?? '').replace(/^d-/, '');

/** Tự đoán chủ đề năm trước cho từng chủ đề năm nay: trùng tên → chứa nhau → không chọn. Trả { [currentId]: prevId | '' }. */
export function guessThemeMap(currentThemes, prevThemes) {
  const prev = (prevThemes || []).map((t) => ({ id: String(t.id), key: normalizeContent(t.name) })).filter((t) => t.key);
  const map = {};
  for (const t of currentThemes || []) {
    const key = normalizeContent(t.name || t.abbr);
    const hit = key && (prev.find((p) => p.key === key) || prev.find((p) => p.key.includes(key) || key.includes(p.key)));
    map[String(t.id)] = hit ? hit.id : '';
  }
  return map;
}

/**
 * Ghép tick năm trước vào form: themeMap { currentThemeId: prevThemeId }. Một câu khớp nhiều nội dung cùng lĩnh vực ⇒ áp cho
 * tất cả; bỏ nội dung trống và cặp đã tick. unmatched = số tick (đã chọn chủ đề) không tìm thấy câu nội dung nào.
 */
export function buildGroups(form, themeMap, prev) {
  const byDomainText = new Map();
  for (const d of form?.domains || [])
    for (const r of d.rows || [])
      for (const c of r.contents || []) {
        const k = normalizeContent(c.text);
        if (!k) continue;
        const key = `${domainKey(d.id)}|${k}`;
        if (!byDomainText.has(key)) byDomainText.set(key, []);
        byDomainText.get(key).push(c);
      }
  const prevName = new Map((prev?.themes || []).map((t) => [String(t.id), t.name || '']));
  const groups = [];
  let unmatched = 0;
  for (const t of form?.themes || []) {
    const themeId = String(t.id);
    const source = themeMap?.[themeId];
    if (!source) continue;
    const lines = [];
    const seen = new Set();
    for (const tick of prev?.ticks || []) {
      if (String(tick.themeId) !== source) continue;
      const k = normalizeContent(tick.text);
      const contents = byDomainText.get(`${domainKey(tick.domainId)}|${k}`);
      if (!contents) {
        unmatched += 1;
        continue;
      }
      const key = `${themeId}|${domainKey(tick.domainId)}|${k}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ids = contents.filter((c) => !(c.themes || []).map(String).includes(themeId)).map((c) => String(c.id));
      if (ids.length) lines.push({ key, text: contents[0].text.trim(), ids });
    }
    if (lines.length) groups.push({ themeId, name: t.name || t.abbr || '', sources: [{ from: prevName.get(source) || '', lines }] });
  }
  return { groups, unmatched };
}

/** Số tick sẽ thêm theo chủ đề (xem trước). */
export const previewCounts = (groups) =>
  (groups || []).map((g) => ({
    themeId: g.themeId,
    name: g.name,
    count: g.sources.reduce((n, s) => n + s.lines.reduce((m, l) => m + l.ids.length, 0), 0),
  }));
