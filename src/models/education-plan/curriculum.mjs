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
  (form?.domains || []).flatMap((d) => {
    let sub = null;
    let group = null;
    return (d.rows || []).flatMap((r) => {
      if (r.kind === 'sub') { sub = r; group = null; return []; }
      if (r.kind === 'group') { group = r; return []; }
      return r.kind === 'goal' && norm(r.text) ? [{
        id: r.id, domainId: d.id, domainName: d.name, text: r.text,
        subRowId: sub?.id ?? null, groupRowId: group?.id ?? null, sub, group,
      }] : [];
    });
  });

const matchesParent = (actual, filter) => !filter || (filter === '@none' ? actual == null : String(actual) === String(filter));

export const filterGoalTargets = (form, filter = {}) => goalTargets(form).filter((t) =>
  matchesParent(t.domainId, filter.domainId) && matchesParent(t.subRowId, filter.subRowId) && matchesParent(t.groupRowId, filter.groupRowId),
);

export function validContentSelection(form, filter, targetId, suggestions, picked) {
  const target = filterGoalTargets(form, filter).find((t) => String(t.id) === String(targetId));
  return { targetId: target?.id || '', items: target ? suggestions.filter((c) => picked.has(c.id)) : [] };
}

export function filterCurriculumContents(form, filter = {}, contents = []) {
  const domain = (form.domains || []).find((d) => String(d.id) === String(filter.domainId));
  if (filter.domainId && !domain) return [];
  let subId;
  if (filter.subRowId === '@none') subId = null;
  else if (filter.subRowId) {
    const sub = domain?.rows.find((r) => r.kind === 'sub' && String(r.id) === String(filter.subRowId));
    if (!sub) return [];
    subId = sub.curriculumSubDomainId ?? (filter.sourceSubId === '@none' ? null : filter.sourceSubId);
    if (subId == null && filter.sourceSubId !== '@none') return [];
  }
  return contents.filter((c) => (!domain || c.domainName === domain.name) &&
    (subId === undefined || (subId == null ? c.subDomainId == null : String(c.subDomainId) === String(subId))));
}

export function curriculumOptions(goals, scope, kind) {
  if (!scope.domainName || scope.subDomainId === undefined || (kind !== 'group' && scope.expectedResultId == null)) return [];
  const mine = goals.filter((g) => g.domainName === scope.domainName &&
    (scope.subDomainId == null ? g.subDomainId == null : String(g.subDomainId) === String(scope.subDomainId)) &&
    (kind === 'group' || String(g.expectedResultId) === String(scope.expectedResultId)));
  if (kind === 'group') return [...new Map(mine.map((g) => [JSON.stringify([g.sourceId, g.expectedResultId]), {
    key: JSON.stringify([g.sourceId, g.expectedResultId]), text: g.groupText,
    patch: { curriculumExpectedResultId: g.expectedResultId, curriculumText: g.groupText },
  }])).values()];
  if (kind === 'goal') return mine.map((g) => ({ key: JSON.stringify([g.sourceId, g.id]), text: g.goalText,
    patch: { curriculumGoalId: g.id, curriculumGoalText: g.goalText, curriculumSectionRef: g.sectionRef } }));
  return mine.flatMap((g) => (g.contents || []).map((text, index) => ({ key: JSON.stringify([g.sourceId, g.id, index]), text })));
}

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

/**
 * Mục tiêu Bộ đã có trong bản soạn (cùng lĩnh vực, cùng liên kết nguồn hoặc cùng câu): nội dung mới tích được thêm vào
 * mục tiêu đó, bỏ câu đã có (Tiền 04/11). Trả { domains, added, matched: Set id mục tiêu Bộ đã khớp }.
 */
export function addContentsToExistingGoals(form, goals, makeId) {
  const matched = new Set();
  let added = 0;
  const domains = (form.domains || []).map((d) => {
    const mine = goals.filter((g) => g.domainName === d.name);
    if (!mine.length) return d;
    let changed = false;
    const rows = (d.rows || []).map((r) => {
      if (r.kind !== 'goal') return r;
      const g = mine.find(
        (x) =>
          !matched.has(x.id) &&
          ((r.curriculumGoalId != null && String(r.curriculumGoalId) === String(x.id)) || norm(r.text) === norm(x.goalText)),
      );
      if (!g) return r;
      matched.add(g.id);
      const have = new Set((r.contents || []).map((c) => norm(c.text)));
      const extra = [];
      for (const text of g.contents || []) {
        if (have.has(norm(text))) continue;
        have.add(norm(text));
        extra.push({ id: makeId(), text, themes: [] });
      }
      if (!extra.length) return r;
      added += extra.length;
      changed = true;
      return { ...r, contents: [...(r.contents || []), ...extra] };
    });
    return changed ? { ...d, rows } : d;
  });
  return { domains, added, matched };
}

/** Đường dẫn trang nguồn tới đúng dòng (anchor `cg-`/`cs-`/`cgr-`; chỉ có id mục tiêu thì tới mục tiêu). */
export const curriculumSourceLink = (ageGroupId, curriculumGoalId, anchor) => {
  const hash = anchor || (curriculumGoalId ? `cg-${curriculumGoalId}` : '');
  return `/education/curriculum-sources${ageGroupId ? `?ageGroup=${encodeURIComponent(ageGroupId)}` : ''}${hash ? `#${hash}` : ''}`;
};

/**
 * Cây cho danh sách GoalPicker (hộp Lấy từ Bộ và trang Nguồn chương trình — cùng giao diện, Tiền 03/11).
 * Mã MT như bảng mục tiêu: số của Bộ ("2.1"); kết quả chỉ có một mục tiêu không đánh số ⇒ MT<số kết quả>.1.
 */
export const curriculumPickTree = (tree, anchorOf = (id) => `pick-cg-${id}`) =>
  tree.map((d) => ({
    name: d.name,
    subs: d.subs.map((s) => ({
      key: s.key,
      name: s.name,
      groups: s.groups.map((g) => ({
        key: g.key,
        title: `${g.no ? `${g.no}. ` : ''}${g.text}`,
        goals: g.goals.map((x, i) => {
          const no = x.goalNo || (g.no ? `${g.no}.${i + 1}` : '');
          return { id: x.id, code: no ? `MT${no}` : '', text: x.goalText, contents: x.contents, anchor: anchorOf(x.id) };
        }),
      })),
    })),
  }));
