import { DOMAINS } from '@/models/education-plan/educationPlanConstants';
import { curriculumLink } from '@/models/education-plan/curriculum.mjs';
import { toRows } from '@/models/education-plan/goalTable';

const readRows = (domain, domainIndex) => {
  let n = 0;
  return toRows(domain, () => `legacy-${domainIndex}-${++n}`);
};

export const getImportGoals = (source) =>
  (source.domains || []).flatMap((domain, domainIndex) => {
    let sub = null;
    let group = null;
    return readRows(domain, domainIndex).flatMap((row, rowIndex) => {
      if (row.kind === 'sub') {
        sub = row;
        group = null;
      } else if (row.kind === 'group') group = row;
      if (row.kind !== 'goal') return [];
      return [
        {
          id: row.id,
          domainId: domain.id,
          domainName: domain.name,
          text: row.text,
          code: row.code || (domain.rows ? domain.items?.find((item) => item.id === row.id)?.code : domain.items?.[rowIndex]?.code) || '',
          contents: row.contents || [],
          // Mục tiêu lấy từ Chương trình của Bộ (BE:EDU-28): giữ liên kết nguồn khi chép
          ...(row.curriculumGoalId
            ? {
                curriculumGoalId: row.curriculumGoalId,
                curriculumGoalText: row.curriculumGoalText,
                curriculumSectionRef: row.curriculumSectionRef,
              }
            : {}),
          sub,
          group,
        },
      ];
    });
  });

const contexts = (rows) => {
  let sub = null;
  let group = null;
  return new Map(
    rows.map((row) => {
      if (row.kind === 'sub') {
        sub = row.id;
        group = null;
      } else if (row.kind === 'group') group = row.id;
      return [row.id, [row.kind === 'sub' ? null : sub, row.kind === 'goal' ? group : null]];
    }),
  );
};

export const mergeImportedGoals = (target, source, selectedGoalIds, makeId) => {
  const selected = new Set(selectedGoalIds);
  const domains = [...(target.domains || [])];
  const report = { added: 0, duplicates: 0, unavailable: [] };
  const states = new Map();
  const usedIds = new Set(
    [target, source].flatMap((plan) =>
      (plan.domains || []).flatMap((domain, i) =>
        readRows(domain, i).flatMap((row) => [String(row.id), ...(row.contents || []).map((content) => String(content.id))]),
      ),
    ),
  );
  let suffix = 0;
  const nextId = () => {
    const raw = String(makeId());
    const base = /^[a-z]/i.test(raw) ? raw : `import-${raw}`;
    let id = base;
    while (usedIds.has(id)) id = `${base}-${++suffix}`;
    usedIds.add(id);
    return id;
  };
  for (const incoming of getImportGoals(source)) {
    if (!selected.has(incoming.id)) continue;
    const unavailable = (reason) =>
      report.unavailable.push({ id: incoming.id, label: incoming.text, domainName: incoming.domainName, reason });
    const index = domains.findIndex((domain) => domain.name === incoming.domainName);
    if (index < 0 || domains[index].active === false || !DOMAINS.includes(incoming.domainName)) {
      unavailable('Lĩnh vực không có trong danh mục hiện tại của kế hoạch đích.');
      continue;
    }
    if (!states.has(index)) {
      const rows = domains[index].rows || readRows(domains[index], index);
      states.set(index, {
        rows,
        paths: contexts(toRows({ rows }, nextId)),
        texts: new Set(rows.filter((row) => row.kind === 'goal').map((row) => row.text.trim())),
        sub: null,
        group: null,
        subId: null,
        groupId: null,
      });
    }
    const state = states.get(index);
    if (state.texts.has(incoming.text.trim())) {
      report.duplicates += 1;
      continue;
    }
    const additions = [];
    let { sub, group, subId, groupId } = state;
    const addHeading = (row) => {
      // Lĩnh vực con/nhóm lấy từ Bộ giữ liên kết nguồn khi chép (BE:EDU-28)
      const heading = { id: nextId(), kind: row.kind, text: row.text, ...curriculumLink(row) };
      additions.push(heading);
      return heading.id;
    };
    if (incoming.sub && (incoming.sub !== sub || (!incoming.group && group))) {
      subId = addHeading(incoming.sub);
      sub = incoming.sub;
      group = null;
      groupId = null;
    }
    if (incoming.group && incoming.group !== group) {
      groupId = addHeading(incoming.group);
      group = incoming.group;
    }
    const row = {
      id: nextId(),
      kind: 'goal',
      text: incoming.text,
      ...(incoming.curriculumGoalId
        ? {
            curriculumGoalId: incoming.curriculumGoalId,
            curriculumGoalText: incoming.curriculumGoalText,
            curriculumSectionRef: incoming.curriculumSectionRef,
          }
        : {}),
      contents: incoming.contents.map((content) => ({ id: nextId(), text: content.text, themes: [] })),
    };
    additions.push(row);
    const candidate = [...state.rows, ...additions];
    const candidatePaths = contexts(toRows({ rows: candidate }, nextId));
    const expected = [incoming.sub ? subId : null, incoming.group ? groupId : null];
    // Bộ chuẩn hóa có thể kéo sub đầu tiên lên trước các dòng đích cũ.
    const preservesPaths = [...state.paths].every(([id, path]) => candidatePaths.get(id)?.every((parent, i) => parent === path[i]));
    if (!preservesPaths || !candidatePaths.get(row.id)?.every((parent, i) => parent === expected[i])) {
      unavailable('Không thể giữ nguyên lĩnh vực con/nhóm của mục tiêu và dữ liệu đích; vui lòng đặt lại ngữ cảnh thủ công.');
      continue;
    }
    Object.assign(state, { rows: candidate, paths: candidatePaths, sub, group, subId, groupId });
    state.texts.add(incoming.text.trim());
    domains[index] = { ...domains[index], rows: candidate };
    report.added += 1;
  }
  return { domains, report };
};
