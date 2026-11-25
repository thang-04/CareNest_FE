// BE:EDU-103 "AI gom nội dung vào chủ đề" ở kế hoạch tổ: gom gợi ý để duyệt, áp dụng chỉ thêm tick, tìm/lọc bảng tick.
// Form: domains[].rows[].contents[] { id, text, themes: [themeId] } (id dạng chuỗi).

/** Chữ để so: bỏ dấu tiếng Việt, không phân biệt hoa thường, gộp khoảng trắng. */
export const plainText = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const contentsOf = (domains) => (domains || []).flatMap((d) => (d.rows || []).flatMap((r) => r.contents || []));
// "Trùng chữ" = cùng một câu (giữ dấu), chỉ bỏ khác biệt hoa thường và khoảng trắng
const textKey = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Gom kết quả AI theo chủ đề → căn cứ `from`. Một dòng = một câu nội dung trong một chủ đề; ids = mọi nội dung cùng câu
 * chưa có tick chủ đề đó. Bỏ nội dung trống (EDU-50), id lạ và cặp đã tick trong bản đang soạn.
 * Trả [{ themeId, name, sources: [{ from, lines: [{ key, text, ids }] }] }] theo thứ tự chủ đề của form.
 */
export function groupMatches(form, matches) {
  const contents = contentsOf(form?.domains);
  const byId = new Map(contents.map((c) => [String(c.id), c]));
  const sameText = new Map();
  for (const c of contents) {
    const k = textKey(c.text);
    if (!k) continue;
    if (!sameText.has(k)) sameText.set(k, []);
    sameText.get(k).push(c);
  }
  const themes = (form?.themes || []).filter((t) => t?.id != null);
  const groups = new Map(themes.map((t) => [String(t.id), { themeId: String(t.id), name: t.name || t.abbr || '', sources: [] }]));
  const seen = new Set();
  for (const m of matches || []) {
    const themeId = String(m.themeId);
    const content = byId.get(String(m.contentId));
    const group = groups.get(themeId);
    const k = textKey(content?.text);
    if (!group || !k) continue;
    const key = `${themeId}|${k}`;
    if (seen.has(key)) continue;
    const ids = sameText
      .get(k)
      .filter((c) => !(c.themes || []).map(String).includes(themeId))
      .map((c) => String(c.id));
    if (!ids.length) continue;
    seen.add(key);
    const from = String(m.from || '').trim();
    let source = group.sources.find((s) => s.from.toLowerCase() === from.toLowerCase());
    if (!source) group.sources.push((source = { from, lines: [] }));
    source.lines.push({ key, text: content.text.trim(), ids });
  }
  return [...groups.values()].filter((g) => g.sources.length);
}

export const reviewLines = (groups) =>
  (groups || []).flatMap((g) => g.sources.flatMap((s) => s.lines.map((l) => ({ ...l, themeId: g.themeId }))));

/** "Đang ở N chủ đề" của một câu nội dung: tick đang có (mọi id cùng câu) + dòng đang chọn trong màn kết quả. */
export function themeCount(form, text, groups, picked) {
  const k = textKey(text);
  const themes = new Set();
  for (const c of contentsOf(form?.domains)) if (textKey(c.text) === k) (c.themes || []).forEach((t) => themes.add(String(t)));
  for (const l of reviewLines(groups)) if (picked.has(l.key) && l.key.endsWith(`|${k}`)) themes.add(l.themeId);
  return themes.size;
}

/** Áp các dòng đã chọn vào form: chỉ thêm tick (FR4.5), không bỏ tick có sẵn, bỏ nội dung trống. Trả { domains, added }. */
export function applyPicked(form, groups, picked) {
  const add = new Map();
  for (const l of reviewLines(groups)) {
    if (!picked.has(l.key)) continue;
    for (const id of l.ids) {
      if (!add.has(id)) add.set(id, new Set());
      add.get(id).add(l.themeId);
    }
  }
  let added = 0;
  const domains = (form?.domains || []).map((d) => ({
    ...d,
    rows: (d.rows || []).map((r) =>
      r.contents
        ? {
            ...r,
            contents: r.contents.map((c) => {
              const extra = add.get(String(c.id));
              if (!extra || !String(c.text ?? '').trim()) return c;
              const themes = [...(c.themes || [])];
              for (const t of extra)
                if (!themes.map(String).includes(t)) {
                  themes.push(t);
                  added += 1;
                }
              return themes.length === (c.themes || []).length ? c : { ...c, themes };
            }),
          }
        : r,
    ),
  }));
  return { domains, added };
}

/** Nội dung có hiện khi lọc bảng tick: chứa chữ tìm (bỏ dấu) và, nếu bật, chưa thuộc chủ đề nào. */
export const contentVisible = (content, query, unassigned) =>
  (!unassigned || !(content.themes || []).length) && (!plainText(query) || plainText(content.text).includes(plainText(query)));

/**
 * Bản xem đã lọc của các lĩnh vực: giữ mục tiêu có nội dung hiện, bỏ lĩnh vực con / nhóm không còn mục tiêu nào bên dưới.
 * Trả null khi không lọc gì.
 */
export function filterDomains(domains, query, unassigned) {
  if (!plainText(query) && !unassigned) return null;
  return (domains || []).map((d) => {
    const rows = [];
    for (const r of d.rows || []) {
      if (r.kind !== 'goal') rows.push(r);
      else {
        const contents = (r.contents || []).filter((c) => contentVisible(c, query, unassigned));
        if (contents.length) rows.push({ ...r, contents });
      }
    }
    // Bỏ tiêu đề (sub/group) không còn mục tiêu nào tới tiêu đề cùng hoặc cao hơn kế tiếp
    const kept = rows.filter((r, i) => {
      if (r.kind === 'goal') return true;
      for (let j = i + 1; j < rows.length; j++) {
        if (rows[j].kind === 'goal') return true;
        if (rows[j].kind === 'sub' || (r.kind === 'group' && rows[j].kind === 'group')) return false;
      }
      return false;
    });
    // Giữ cả lĩnh vực trống để số thứ tự lĩnh vực (I, II…) không đổi khi lọc
    return { ...d, rows: kept };
  });
}

export const hasGoalRows = (domains) => (domains || []).some((d) => (d.rows || []).some((r) => r.kind === 'goal'));

/**
 * Ghi thay đổi trên bản xem đã lọc về form đầy đủ: nội dung đang hiện lấy bản mới (tick, chữ), nội dung bị ẩn giữ nguyên,
 * nội dung mới thêm trong lúc lọc nối sau nội dung đang hiện cuối cùng của mục tiêu đó.
 */
export function mergeFiltered(full, view, next) {
  const shown = new Set(contentsOf(view).map((c) => String(c.id)));
  const nextRows = new Map((next || []).flatMap((d) => (d.rows || []).map((r) => [String(r.id), r])));
  return (full || []).map((d) => ({
    ...d,
    rows: (d.rows || []).map((r) => {
      const changed = nextRows.get(String(r.id));
      if (!changed || !r.contents) return r;
      const updated = new Map((changed.contents || []).map((c) => [String(c.id), c]));
      const fresh = (changed.contents || []).filter((c) => !r.contents.some((x) => String(x.id) === String(c.id)));
      const contents = [];
      let lastShown = -1;
      for (const c of r.contents) {
        const id = String(c.id);
        if (!shown.has(id)) contents.push(c);
        else if (updated.has(id)) {
          contents.push(updated.get(id));
          lastShown = contents.length;
        }
      }
      contents.splice(lastShown < 0 ? contents.length : lastShown, 0, ...fresh);
      return { ...r, contents };
    }),
  }));
}
