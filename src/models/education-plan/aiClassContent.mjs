// BE:EDU-115 — AI viết lại nội dung kế hoạch chủ đề: thay dòng cũ của phạm vi đã chọn thành nháp chờ ✓/✗. Thẻ hoạt động gắn
// dòng bị thay bị xóa theo bản AI; ✗ trả lại cả dòng cũ lẫn thẻ.

const refsOf = (goalId, indexes) => new Set(indexes.map((i) => `${goalId}:${i}`));
const replacedIndexes = (lines, lineIndex) => (lineIndex == null ? lines.map((_, i) => i) : [lineIndex]);

export const formatContentLines = (lines) => lines.map((l) => `- ${l}`).join('\n');

/** goals: [{ id, lines }] đang có trong bảng; scope: {} = tất cả, { goalId } hoặc { goalId, lineIndex }. */
export function rewriteRequestGoals(goals, scope = {}) {
  return goals
    .filter((g) => scope.goalId == null || String(g.id) === String(scope.goalId))
    .map((g) => ({ id: g.id, lines: g.lines, lineIndex: scope.lineIndex ?? null }));
}

/** Thẻ sẽ bị xóa nếu giữ bản AI (để hỏi trước khi gọi). */
export function cardsLostByRewrite(cards, requestGoals) {
  const refs = new Set(requestGoals.flatMap((g) => [...refsOf(g.id, replacedIndexes(g.lines, g.lineIndex))]));
  return cards.filter((c) => (c.contentRefs || []).some((r) => refs.has(r)));
}

/**
 * Áp kết quả: mục tiêu không có gợi ý hoặc đã bị sửa trong lúc chờ thì giữ nguyên.
 * current: { [goalId]: { text, lines } } là nội dung hiện tại của bảng.
 * Trả { rows: { [goalId]: text }, cards, pending: { [goalId]: { before, sources, refs, removed } }, changed, skipped }.
 */
export function applyRewrite({ requestGoals, current, cards, matches }) {
  const rows = {};
  const pending = {};
  let nextCards = cards;
  let skipped = 0;
  for (const asked of requestGoals) {
    const mine = (matches || []).filter((m) => String(m.goalId) === String(asked.id) && String(m.text ?? '').trim());
    if (!mine.length) continue;
    const now = current[asked.id];
    if (!now || JSON.stringify(now.lines) !== JSON.stringify(asked.lines)) {
      skipped += 1;
      continue;
    }
    const lines =
      asked.lineIndex == null
        ? mine.map((m) => m.text.trim())
        : asked.lines.map((l, i) => (i === asked.lineIndex ? mine[0].text.trim() : l));
    const refs = refsOf(asked.id, replacedIndexes(asked.lines, asked.lineIndex));
    const removed = nextCards.filter((c) => (c.contentRefs || []).some((r) => refs.has(r)));
    nextCards = nextCards.filter((c) => !removed.includes(c));
    rows[asked.id] = formatContentLines(lines);
    pending[asked.id] = {
      before: now.text,
      sources: [...new Set((asked.lineIndex == null ? mine : mine.slice(0, 1)).map((m) => m.source || 'AI'))],
      refs: mine.map((m) => m.ref).filter(Boolean),
      removed,
    };
  }
  return { rows, cards: nextCards, pending, changed: Object.keys(rows).length, skipped };
}

/** ✗: trả lại thẻ đã gỡ (thẻ đã được thêm lại bằng tay thì không nhân đôi). */
export const restoreCards = (cards, removed) => [...cards, ...removed.filter((r) => !cards.some((c) => c.id === r.id))];
