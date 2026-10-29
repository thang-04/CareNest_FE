import { useAsync } from '@/hooks/useAsync';
import * as service from '@/services/education-plan/educationPlanService';

/** Thay đổi giữa hai phiên bản kế hoạch năm (BE:EDU-25); fromId trống ⇒ so với phiên bản nguồn. */
export function usePlanChanges(planId, fromId, enabled = true) {
  return useAsync(() => service.getGoalChanges(planId, fromId), [planId, fromId], { enabled: enabled && !!planId });
}
