// Lấy thẻ hoạt động từ kế hoạch chủ đề đã ban hành của chính lớp ở năm trước (Tiền 13/11/2026): MT và nội dung ghép theo chữ,
// vì số MT/id đổi theo kế hoạch năm mới. Thẻ không ghép được MT nào thì bỏ qua và báo lý do.

const norm = (s) =>
  String(s || '')
    .replace(/^[-+•]\s*/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.:;,…]+$/, '');

/**
 * cards: thẻ nguồn { slot, name, goalIds, contentRefs }; sourceGoals/targetGoals: [{ id, text, lines: [nội dung] }];
 * existing: thẻ đang có (bỏ trùng loại giờ + tên); makeCard(fields) tạo thẻ mới với id mới.
 * Trả { cards, skipped: [{ name, reason }] }.
 */
export function mapActivityCards(cards, sourceGoals, targetGoals, existing = [], makeCard = (c) => c) {
  const src = new Map(sourceGoals.map((g) => [String(g.id), g]));
  const byText = new Map(targetGoals.map((g) => [norm(g.text), g]));
  const have = new Set(existing.map((c) => `${c.slot}|${norm(c.name)}`));
  const out = [];
  const skipped = [];
  for (const card of cards) {
    const key = `${card.slot}|${norm(card.name)}`;
    if (have.has(key)) {
      skipped.push({ name: card.name, reason: 'Đã có hoạt động này' });
      continue;
    }
    const pairs = (card.goalIds || [])
      .map((id) => [src.get(String(id)), byText.get(norm(src.get(String(id))?.text))])
      .filter(([s, t]) => s && t);
    if (!pairs.length) {
      skipped.push({ name: card.name, reason: 'Không có mục tiêu tương ứng trong chủ đề năm nay' });
      continue;
    }
    const contentRefs = (card.contentRefs || []).flatMap((ref) => {
      const [gid, idx] = String(ref).split(':');
      const pair = pairs.find(([s]) => String(s.id) === gid);
      const line = pair && pair[0].lines[Number(idx)];
      const j = line === undefined ? -1 : pair[1].lines.findIndex((l) => norm(l) === norm(line));
      return j < 0 ? [] : [`${pair[1].id}:${j}`];
    });
    have.add(key);
    out.push(makeCard({ slot: card.slot, name: card.name, goalIds: [...new Set(pairs.map(([, t]) => String(t.id)))], contentRefs }));
  }
  return { cards: out, skipped };
}
