import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { listAllChildrenForGuardians, listGuardians } from '@/services/account/guardianService';

export function useChildGuardians(childId) {
  const { user } = useAuth();
  return useAsync(() => listGuardians(childId, user), [childId, user?.id], {
    refreshOnDataChange: true,
    enabled: !!user && !!childId,
  });
}

/** Mọi trẻ trong phạm vi của một điểm trường (rỗng = mọi điểm trường mình phụ trách). */
export function useCampusGuardianChildren(campusId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useAsync(() => listAllChildrenForGuardians(campusId || undefined, user), [campusId, user?.id], {
    refreshOnDataChange: true,
    enabled: !!user && enabled,
  });
}
