// BE:EDU-106: chỉ duyệt/chọn mục C cho mục tiêu còn trống; quyền và ứng viên hợp lệ do BE kiểm lại.
const keyText = (text) => String(text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
const empty = (row) => !(row.contents || []).some((content) => String(content.text ?? '').trim());

export const goalContentStamp = (plan) => JSON.stringify(plan);

export function goalContentGroups(plan, matches, catalog) {
  const candidates = new Map((catalog || []).map((content) => [String(content.id), content]));
  const goals = new Map((plan?.domains || []).flatMap((domain) => (domain.rows || [])
    .filter((row) => row.kind === 'goal' && row.text?.trim() && empty(row))
    .map((row) => [String(row.id), { row, domain }])));
  const groups = new Map();
  const seen = new Set();
  for (const match of matches || []) {
    const goal = goals.get(String(match.goalId));
    const content = candidates.get(String(match.curriculumContentId));
    const from = String(match.from || '').trim();
    if (!goal || !content?.text?.trim() || content.domainName !== goal.domain.name || !from
        || !goal.row.text.toLowerCase().includes(from.toLowerCase())) continue;
    const text = content.text;
    const duplicate = `${goal.row.id}|${keyText(text)}`;
    if (seen.has(duplicate)) continue;
    seen.add(duplicate);
    const id = String(goal.row.id);
    if (!groups.has(id)) groups.set(id, { goalId: id, text: goal.row.text, domain: goal.domain.name, lines: [] });
    groups.get(id).lines.push({ key: `${id}:${content.id}`, text, from });
  }
  return [...groups.values()];
}

export function applyGoalContents(plan, groups, picked, stamp, makeId) {
  if (goalContentStamp(plan) !== stamp) return null;
  const chosen = new Map((groups || []).map((group) => [group.goalId, group.lines.filter((line) => picked.has(line.key))]));
  let added = 0;
  const domains = (plan.domains || []).map((domain) => ({ ...domain, rows: (domain.rows || []).map((row) => {
    const selected = chosen.get(String(row.id));
    if (row.kind !== 'goal' || !empty(row) || !selected?.length) return row;
    const have = new Set((row.contents || []).map((c) => keyText(c.text)));
    const contents = [...(row.contents || [])];
    for (const line of selected) {
      if (!line.text.trim() || have.has(keyText(line.text))) continue;
      have.add(keyText(line.text));
      contents.push({ id: makeId(), text: line.text, themes: [] });
      added += 1;
    }
    return { ...row, contents };
  }) }));
  return { domains, added };
}

// Tách phần điều phối để kiểm lưu lỗi, id sau lưu và kết quả lỗi thời bằng cùng hàm UI sử dụng.
export async function requestGoalContents({ ensureSaved, current, request, loadCatalog, active }) {
  const saved = await ensureSaved();
  if (!active()) return null;
  if (!saved?.planId || !saved.allowed) throw new Error('Chưa lưu được kế hoạch hoặc đã mất quyền sửa nên chưa gọi AI.');
  const stamp = goalContentStamp(saved.plan);
  const [response, catalog] = await Promise.all([request(saved.planId), loadCatalog(saved.plan.ageGroupId)]);
  const latest = current();
  if (!active() || !latest.allowed || stamp !== goalContentStamp(latest.plan)) return null;
  return { stamp, groups: goalContentGroups(saved.plan, response?.matches, catalog), failedDomains: response?.failedDomains || [] };
}
