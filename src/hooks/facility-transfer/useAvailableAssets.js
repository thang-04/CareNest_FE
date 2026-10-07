import { useAsync } from '@/hooks/useAsync';
import { getAvailableAssets } from '@/services/facility-transfer/transferService';

/** Assets currently at the sending location, with free quantity. */
export function useAvailableAssets(locationId, excludeTransferId) {
  const { data, loading, error, reload } = useAsync(
    () => getAvailableAssets(locationId, excludeTransferId),
    [locationId, excludeTransferId],
    {
      enabled: !!locationId,
    },
  );
  return { assets: data || [], loading: !!locationId && loading, error, reload };
}
