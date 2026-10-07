import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { getTransferById, getTransfers } from '@/services/facility-transfer/transferService';

export function useTransfers(filters) {
  const { user } = useAuth();
  const key = JSON.stringify(filters || {});
  const { data, loading, error, reload } = useAsync(() => getTransfers(filters, user), [key, user?.id], {
    refreshOnDataChange: true,
  });
  return { transfers: data || [], loading, error, reload };
}

/**
 * live = reload when the data changes elsewhere (other role, other tab).
 * Editing pages pass live=false so a background refresh never resets the form.
 */
export function useTransfer(id, { live = true } = {}) {
  const { user } = useAuth();
  const { data, setData, loading, error, reload } = useAsync(() => getTransferById(id, user), [id, user?.id], {
    refreshOnDataChange: live,
    enabled: !!id,
  });
  return { transfer: data, setTransfer: setData, loading, error, reload };
}
