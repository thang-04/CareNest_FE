import { recoveryKey, yearPlanContentKey } from '@/models/education-plan/yearPlanAutosave.mjs';

export function findYearPlanRecovery(userId, planKey, current) {
  const prefix = recoveryKey(userId, planKey);
  const drafts = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const exactPlan = key === prefix || key?.startsWith(`${prefix}:`);
    const unconfirmedCreate = key?.startsWith(recoveryKey(userId, 'new-'));
    if (!exactPlan && !unconfirmedCreate) continue;
    try {
      const entry = JSON.parse(localStorage.getItem(key));
      const sameIdentity = entry?.doc?.schoolYear === current.schoolYear && entry?.doc?.ageGroupId === current.ageGroupId;
      if (entry?.doc && (exactPlan || sameIdentity) && yearPlanContentKey(entry.doc) !== yearPlanContentKey(current))
        drafts.push({ ...entry, sourceKey: key });
    } catch {
      /* Bản hỏng không làm mất các bản phục hồi khác. */
    }
  }
  return drafts.sort((a, b) => b.savedAt - a.savedAt)[0] || null;
}

export function storeYearPlanRecovery(userId, planKey, slot, entry) {
  localStorage.setItem(`${recoveryKey(userId, planKey)}:${slot}`, JSON.stringify(entry));
}

export function removeYearPlanRecovery(userId, planKey, slot, sourceKey) {
  const prefix = recoveryKey(userId, planKey);
  if (slot) localStorage.removeItem(`${prefix}:${slot}`);
  if (sourceKey?.startsWith(recoveryKey(userId, ''))) localStorage.removeItem(sourceKey);
}
