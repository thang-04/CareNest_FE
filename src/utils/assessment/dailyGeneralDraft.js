import { EMOTION } from '@/models/assessment/assessmentConstants';
import { EATING, NAP, PARTICIPATION } from '@/models/assessment/dailyObservationOptions';

// Giá trị gợi ý chỉ trở thành ghi nhận khi giáo viên bấm Lưu.
export const createGeneralDraft = (row, mealSessions) => ({
  healthSigns: row.health.signs,
  healthNote: row.health.note || '',
  healthOverridden: row.health.overridden,
  meals: Object.fromEntries(mealSessions.map((session) => [session, row.meals[session] || EATING.AN_HET])),
  nap: row.nap || NAP.NGU_TOT,
  emotion: row.emotion || EMOTION.HAPPY,
  behaviors: row.behaviors,
  behaviorNote: row.behaviorNote || '',
  participation: row.participation || (row.recorded ? '' : PARTICIPATION.BINH_THUONG),
  flag: !!row.flag,
  comment: row.comment || '',
});

export const getGeneralSaveEntries = (rows, mealSessions, drafts, dirty) =>
  rows
    .filter((row) => !row.recorded || dirty.has(row.childId))
    .map((row) => ({ childId: row.childId, ...(drafts[row.childId] || createGeneralDraft(row, mealSessions)) }));
