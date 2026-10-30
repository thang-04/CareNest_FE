/*
 * Danh mục Chương trình GDMN của Bộ (BE:EDU-28, specs/005-ministry-goal-catalog): dựng "kế hoạch nguồn" để dùng lại
 * hàm ghép mục tiêu EDU-24, thêm gợi ý nội dung vào một mục tiêu. Liên kết nguồn chỉ để bỏ trùng, không hiện nhãn (Tiền 31/10).
 * Danh mục có 3 tầng như kế hoạch (BE V37): lĩnh vực con, nhóm kết quả mong đợi, mục tiêu — tầng nào cũng giữ liên kết nguồn.
 */

const LINK_FIELDS = [
  'curriculumGoalId',
  'curriculumGoalText',
  'curriculumSectionRef',
  'curriculumSubDomainId',
  'curriculumExpectedResultId',
  'curriculumText',
];

/** Các field liên kết nguồn Bộ của một dòng (để chép dòng mà không mất liên kết). */
export const curriculumLink = (row) => Object.fromEntries(LINK_FIELDS.filter((k) => row?.[k] != null).map((k) => [k, row[k]]));

const norm = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Mục tiêu của Bộ (đã lọc theo nhóm tuổi) ⇒ kế hoạch nguồn dạng hàng: lĩnh vực > lĩnh vực con > nhóm > mục tiêu + nội dung.
 * id dòng mục tiêu = `cg-{id}` (dùng để tích chọn); dòng mang liên kết nguồn để lưu và hiện nhãn.
 */
export function curriculumAsSourcePlan(goals) {
  const domains = new Map();
  for (const g of goals) {
    if (!domains.has(g.domainName)) domains.set(g.domainName, { id: `cd-${g.domainName}`, name: g.domainName, rows: [], last: {} });
    const d = domains.get(g.domainName);
    const subKey = g.subDomain ? (g.subDomainId ?? g.subDomain) : null;
    if (subKey !== d.last.sub) {
      if (subKey)
        d.rows.push({
          id: `cs-${g.id}`,
          kind: 'sub',
          text: g.subDomain,
          ...(g.subDomainId ? { curriculumSubDomainId: g.subDomainId, curriculumText: g.subDomain } : {}),
        });
      d.last = { sub: subKey, group: null };
    }
    const groupKey = g.expectedResultId ?? `${g.groupNo}|${g.groupText}`;
    if (groupKey !== d.last.group) {
      d.rows.push({
        id: `cgr-${g.id}`,
        kind: 'group',
        text: g.groupText,
        ...(g.expectedResultId ? { curriculumExpectedResultId: g.expectedResultId, curriculumText: g.groupText } : {}),
      });
      d.last.group = groupKey;
    }
    d.rows.push({
      id: `cg-${g.id}`,
      kind: 'goal',
      text: g.goalText,
      curriculumGoalId: g.id,
      curriculumGoalText: g.goalText,
      curriculumSectionRef: g.sectionRef,
      contents: (g.contents || []).map((text, i) => ({ id: `cgc-${g.id}-${i}`, text, themes: [] })),
    });
  }
  return { id: 'curriculum', domains: [...domains.values()].map(({ last: _last, ...d }) => d) };
}

/** Cây hiển thị trong hộp chọn: [{ name, subs: [{ name, groups: [{ text, goals: [goal] }] }] }]. */
export function curriculumTree(goals) {
  const out = [];
  for (const g of goals) {
    let d = out.at(-1);
    if (!d || d.name !== g.domainName) out.push((d = { name: g.domainName, subs: [] }));
    let s = d.subs.at(-1);
    const subKey = g.subDomain ? (g.subDomainId ?? g.subDomain) : null;
    if (!s || s.key !== subKey) d.subs.push((s = { key: subKey, id: g.subDomainId ?? null, name: g.subDomain || null, groups: [] }));
    let gr = s.groups.at(-1);
    const groupKey = g.expectedResultId ?? `${g.groupNo}|${g.groupText}`;
    if (!gr || gr.key !== groupKey)
      s.groups.push((gr = { key: groupKey, id: g.expectedResultId ?? null, no: g.groupNo, text: g.groupText, goals: [] }));
    gr.goals.push(g);
  }
  return out;
}

/** Mục tiêu đang có trong bản soạn (để chọn đích cho gợi ý nội dung): [{ id, domainName, text }]. */
export const goalTargets = (form) =>
  (form?.domains || []).flatMap((d) =>
    (d.rows || []).filter((r) => r.kind === 'goal' && norm(r.text)).map((r) => ({ id: r.id, domainName: d.name, text: r.text })),
  );

/** Thêm gợi ý nội dung vào một mục tiêu; bỏ câu đã có. Trả { domains, added, duplicates }. */
export function addSuggestedContents(form, goalRowId, suggestions, makeId) {
  let added = 0;
  let duplicates = 0;
  const domains = (form.domains || []).map((d) => ({
    ...d,
    rows: (d.rows || []).map((r) => {
      if (r.id !== goalRowId) return r;
      const have = new Set((r.contents || []).map((c) => norm(c.text)));
      const extra = [];
      for (const s of suggestions) {
        if (have.has(norm(s.text))) {
          duplicates += 1;
          continue;
        }
        have.add(norm(s.text));
        extra.push({ id: makeId(), text: s.text, themes: [] });
        added += 1;
      }
      return extra.length ? { ...r, contents: [...(r.contents || []), ...extra] } : r;
    }),
  }));
  return { domains, added, duplicates };
}

/** Đường dẫn trang nguồn tới đúng dòng (anchor `cg-`/`cs-`/`cgr-`; chỉ có id mục tiêu thì tới mục tiêu). */
export const curriculumSourceLink = (ageGroupId, curriculumGoalId, anchor) => {
  const hash = anchor || (curriculumGoalId ? `cg-${curriculumGoalId}` : '');
  return `/education/curriculum-sources${ageGroupId ? `?ageGroup=${encodeURIComponent(ageGroupId)}` : ''}${hash ? `#${hash}` : ''}`;
};
