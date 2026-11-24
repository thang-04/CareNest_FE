import { EMOTION_LABELS } from '@/models/assessment/assessmentConstants';
import { BEHAVIORS, EATING_LABELS, NAP_LABELS, PARTICIPATION_LABELS } from '@/models/assessment/dailyObservationOptions';
import { MEAL_SESSION_LABELS } from '@/models/mealSessions';
import { HEALTH_SYMPTOMS } from '@/utils/dailyHealthValidation';

const label = (labels, value) => labels[value] || value || 'Chưa ghi nhận';

// Chỉ đọc kết quả BE đã lưu; không biến mặc định hoặc phần kỹ năng đã lưu thành Hoạt động chung đã lưu.
export function dailyOverviewValue(row, criterion) {
  if (!row?.generalRecorded) return 'Chưa lưu';
  switch (criterion) {
    case 'health':
      return row.health?.signs?.length ? row.health.signs.map((key) => label(HEALTH_SYMPTOMS, key)).join(', ') : 'Bình thường';
    case 'eating':
      return (
        Object.entries(row.meals || {})
          .map(([session, value]) => `${label(MEAL_SESSION_LABELS, session)}: ${label(EATING_LABELS, value)}`)
          .join(' · ') || 'Chưa ghi nhận'
      );
    case 'nap':
      return label(NAP_LABELS, row.nap);
    case 'emotion':
      return label(EMOTION_LABELS, row.emotion);
    case 'behavior':
      return row.behaviors?.length ? row.behaviors.map((key) => label(BEHAVIORS, key)).join(', ') : 'Bình thường';
    case 'participation':
      return label(PARTICIPATION_LABELS, row.participation);
    default:
      return 'Chưa ghi nhận';
  }
}
