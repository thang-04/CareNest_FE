import { planBackupKey } from '@/models/education-plan/planBackup.mjs';

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
