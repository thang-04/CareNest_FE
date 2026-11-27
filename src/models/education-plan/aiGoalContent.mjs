// BE:EDU-106 (đổi 28/11/2026): BE chọn nguồn, lọc căn cứ và chữ; FE chỉ gắn kết quả vào đúng mục tiêu của bản vừa lưu
// thành nháp chờ ✓/✗ (như kế hoạch chủ đề). Quyền và ứng viên hợp lệ do BE kiểm.
const keyText = (text) =>
  String(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Nhãn nguồn hiện dưới dòng nội dung AI điền (giá trị `source` của BE). */
export const AI_CONTENT_SOURCE_LABELS = {
  CURRICULUM_C: 'Chương trình Bộ – nội dung theo độ tuổi (mục C)',
  CURRICULUM_D: 'Chương trình Bộ – kết quả mong đợi (mục D)',
  PREVIOUS_YEAR: 'Kế hoạch năm học trước',
  RAG: 'Kho tham khảo của trường',
  AI: 'AI soạn',
};

export const goalContentStamp = (plan) => JSON.stringify(plan);

const SHOWN_MAX = 60;

/** BE:EDU-106 — nhớ câu đã gợi ý theo mục tiêu trong lúc đang soạn để lần sau BE trả câu khác. */
export function rememberShown(shown, matches) {
  const next = { ...shown };
  for (const m of matches || []) next[m.goalId] = [...new Set([...(next[m.goalId] || []), m.text])].slice(-SHOWN_MAX);
  return next;
}

/** Phần `exclude` gửi BE: đúng mục tiêu được hỏi, hoặc mọi mục tiêu ở nút chung; không có gì thì bỏ. */
export function shownFor(shown, goalId = null) {
  const picked = goalId == null ? shown : shown[goalId] ? { [goalId]: shown[goalId] } : {};
  return Object.keys(picked).length ? picked : undefined;
}

/** Vị trí mục tiêu trong bản soạn, để tìm lại đúng mục tiêu sau lần Lưu đầu (id tạm đổi sang id thật). */
export function locateGoal(plan, goalId) {
  for (const [di, d] of (plan?.domains || []).entries())
    for (const [ri, r] of (d.rows || []).entries()) if (String(r.id) === String(goalId)) return { di, ri, text: r.text };
  return null;
}

const goalAt = (plan, at) => {
  const row = at && plan?.domains?.[at.di]?.rows?.[at.ri];
  return row && row.kind === 'goal' && row.text === at.text ? row : null;
};

/**
 * Gắn nội dung BE trả vào mục tiêu; bỏ câu đã có, bỏ dòng nội dung trống của mục tiêu được thêm. Bản soạn đã đổi so với lúc
 * gọi AI ⇒ null. Trả { domains, added, pending: { [contentId]: { source, ref } } }.
 */
export function applyGoalContents(plan, matches, stamp, makeId) {
  if (goalContentStamp(plan) !== stamp) return null;
  const byGoal = new Map();
  for (const m of matches || []) {
    if (!String(m?.text ?? '').trim()) continue;
    const k = String(m.goalId);
    if (!byGoal.has(k)) byGoal.set(k, []);
    byGoal.get(k).push(m);
  }
  let added = 0;
  const pending = {};
  const domains = (plan.domains || []).map((domain) => ({
    ...domain,
    rows: (domain.rows || []).map((row) => {
      const list = row.kind === 'goal' && byGoal.get(String(row.id));
      if (!list) return row;
      const contents = (row.contents || []).filter((c) => String(c.text ?? '').trim());
      const have = new Set(contents.map((c) => keyText(c.text)));
      const before = contents.length;
      for (const m of list) {
        const text = m.text.trim();
        if (have.has(keyText(text))) continue;
        have.add(keyText(text));
        const id = makeId();
        contents.push({ id, text, themes: [] });
        pending[id] = { source: m.source || 'AI', ref: m.ref || null };
        added += 1;
      }
      return contents.length === before ? row : { ...row, contents };
    }),
  }));
  return { domains, added, pending };
}

// Tách phần điều phối để kiểm lưu lỗi, id sau lưu và kết quả lỗi thời bằng cùng hàm UI sử dụng.
export async function requestGoalContents({ ensureSaved, current, request, active, goalId = null }) {
  const at = goalId == null ? null : locateGoal(current().plan, goalId);
  if (goalId != null && !at) return null;
  const saved = await ensureSaved();
  if (!active()) return null;
  if (!saved?.planId || !saved.allowed) throw new Error('Chưa lưu được kế hoạch hoặc đã mất quyền sửa nên chưa gọi AI.');
  let savedGoalId = null;
  if (at) {
    const row = goalAt(saved.plan, at);
    if (!row) return null;
    savedGoalId = row.id;
  }
  const stamp = goalContentStamp(saved.plan);
  const response = await request(saved.planId, savedGoalId);
  const latest = current();
  if (!active() || !latest.allowed || stamp !== goalContentStamp(latest.plan)) return null;
  return { stamp, matches: response?.matches || [], failedDomains: response?.failedDomains || [] };
}
