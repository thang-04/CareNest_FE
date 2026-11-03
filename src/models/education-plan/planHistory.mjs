// Hàm chung chuyển sang models/draftHistory.mjs; giữ đường import cũ cho kế hoạch giáo dục
export { MAX_DRAFTS, upsertDraft, draftsOf, docLines, diffLines } from '@/models/draftHistory.mjs';

/** Dòng nội dung kế hoạch năm học: thông tin chung, mục tiêu/nội dung (kèm chủ đề tích), chủ đề, đợt nghỉ. */
export function yearPlanLines(doc) {
  const abbr = new Map((doc.themes || []).map((t) => [t.id, t.abbr || t.name]));
  const lines = [`Tên kế hoạch: ${doc.title || ''}`];
  if (doc.description) lines.push(`Mô tả: ${doc.description}`);
  for (const d of doc.domains || []) {
    lines.push(d.name);
    for (const r of d.rows || []) {
      if (r.text) lines.push(`• ${r.text}`);
      for (const c of r.contents || []) {
        const ticks = (c.themes || []).map((id) => abbr.get(id)).filter(Boolean);
        if (c.text) lines.push(`– ${c.text}${ticks.length ? ` [${ticks.join(', ')}]` : ''}`);
      }
    }
  }
  for (const t of doc.themes || []) {
    lines.push(`Chủ đề: ${t.name || ''} (${t.abbr || ''}) ${t.start || ''} – ${t.end || ''}`.trim());
    if (t.note) lines.push(`Ghi chú chủ đề ${t.abbr || t.name || ''}: ${t.note}`);
  }
  for (const b of doc.breaks || []) lines.push(`Đợt nghỉ: ${b.label || ''} ${b.start || ''} – ${b.end || ''}`.trim());
  return lines;
}
