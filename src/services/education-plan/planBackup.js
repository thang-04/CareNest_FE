import { planBackupKey } from '@/models/education-plan/planBackup.mjs';
import { draftsOf } from '@/models/education-plan/planHistory.mjs';

export function readPlanBackup(userId, docKey) {
  try {
    return JSON.parse(localStorage.getItem(planBackupKey(userId, docKey)));
  } catch {
    // Bản hỏng coi như không có
    return null;
  }
}

export function writePlanBackup(userId, docKey, entry) {
  localStorage.setItem(planBackupKey(userId, docKey), JSON.stringify(entry));
}

export function removePlanBackup(userId, docKey) {
  localStorage.removeItem(planBackupKey(userId, docKey));
}

/** Các mốc chưa lưu (≤2) của một tài liệu; hết mốc thì xóa khóa. */
export const readPlanDrafts = (userId, docKey) => draftsOf(readPlanBackup(userId, docKey));

export function writePlanDrafts(userId, docKey, entries) {
  if (entries.length) writePlanBackup(userId, docKey, { entries });
  else removePlanBackup(userId, docKey);
}
