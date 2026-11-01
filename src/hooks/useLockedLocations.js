import { useAsync } from './useAsync';
import { getLockedLocations } from '@/services/facilityLockService';

/** { locationId: roundCode } of locations locked by inventory (refreshes on data change). */
export function useLockedLocations() {
  const { data } = useAsync(() => getLockedLocations(), [], { refreshOnDataChange: true });
  return data || {};
}
