import { recoveryKey, yearPlanContentKey } from '@/models/education-plan/yearPlanAutosave.mjs';
import { MAX_DRAFTS } from '@/models/education-plan/planHistory.mjs';

// Mỗi tab một slot = một lần soạn; cùng slot được ghi cả theo planKey lẫn theo ID kế hoạch ⇒ gộp theo slot
const slotOf = (key) => key.split(':').pop();

function scan(userId, planKey, current, { anyContent = false } = {}) {
  const prefix = recoveryKey(userId, planKey);
  const bySlot = new Map();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const exactPlan = key === prefix || key?.startsWith(`${prefix}:`);
    const unconfirmedCreate = key?.startsWith(recoveryKey(userId, 'new-'));
    const byId = current?.id && key?.startsWith(`${recoveryKey(userId, current.id)}:`);
    if (!exactPlan && !unconfirmedCreate && !byId) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key));
      const sameIdentity = entry?.doc?.schoolYear === current.schoolYear && entry?.doc?.ageGroupId === current.ageGroupId;
      if (!entry?.doc || (!exactPlan && !byId && !sameIdentity)) continue;
      if (!anyContent && yearPlanContentKey(entry.doc) === yearPlanContentKey(current)) continue;
      const slot = slotOf(key);
      const known = bySlot.get(slot);
      if (known) known.keys.push(key);
      else bySlot.set(slot, { ...entry, slot, sourceKey: key, keys: [key] });
    } catch {
      /* Bản hỏng không làm mất các mốc khác. */
    }
  }
  return [...bySlot.values()].sort((a, b) => b.savedAt - a.savedAt);
}

/** Tối đa 2 mốc chưa lưu mới nhất, khác nội dung đang mở (Lịch sử phiên bản, Tiền 03/11). */
export const findYearPlanDrafts = (userId, planKey, current) => scan(userId, planKey, current).slice(0, MAX_DRAFTS);

/** Giữ 2 lần soạn mới nhất của kế hoạch này trên máy, xóa các slot cũ hơn. */
export function pruneYearPlanDrafts(userId, planKey, current) {
  scan(userId, planKey, current, { anyContent: true })
    .slice(MAX_DRAFTS)
    .forEach((entry) => entry.keys.forEach((key) => localStorage.removeItem(key)));
}

export function storeYearPlanRecovery(userId, planKey, slot, entry) {
  localStorage.setItem(`${recoveryKey(userId, planKey)}:${slot}`, JSON.stringify(entry));
}

export function removeYearPlanRecovery(userId, planKey, slot, sourceKey) {
  const prefix = recoveryKey(userId, planKey);
  if (slot) localStorage.removeItem(`${prefix}:${slot}`);
  if (sourceKey?.startsWith(recoveryKey(userId, ''))) localStorage.removeItem(sourceKey);
}
