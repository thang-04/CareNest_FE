import { useAuth } from '@/contexts/AuthContext';
import { useGuardianQuery } from '@/hooks/account/useGuardianQuery';
import { sameId } from '@/services/http/idStrings';
import {
  getAccountCandidates,
  listAllChildrenForGuardians,
  listGuardians,
  listPendingGuardians,
  getGuardianStructure,
} from '@/services/account/guardianService';
export function useChildGuardians(id) {
  const { user } = useAuth();
  return useGuardianQuery(() => listGuardians(id, user), [id], { enabled: !!id && !!user });
}
/** Phụ huynh trên hồ sơ trẻ chưa có tài khoản (thông tin theo hồ sơ, chỉ xem). */
export function usePendingGuardians(id) {
  const { user } = useAuth();
  return useGuardianQuery(() => listPendingGuardians(id, user), [id], { enabled: !!id && !!user });
}
export function useCampusGuardianChildren(campusId, { enabled = true } = {}) {
  const { user } = useAuth();
  return useGuardianQuery(() => listAllChildrenForGuardians(campusId, user), [campusId], { enabled: !!user && enabled });
}
export function useGuardianStructure() {
  const { user } = useAuth();
  const query = useGuardianQuery(() => getGuardianStructure(user), []);
  const campuses = query.data?.campuses || [];
  const classrooms = query.data?.classrooms || [];
  return {
    ...query,
    campuses,
    classrooms,
    // id từ module trẻ là chuỗi, từ /campuses, /school-structure là số
    campusName: (id) => campuses.find((row) => sameId(row.id, id))?.name || '',
    classroomName: (id) => classrooms.find((row) => sameId(row.id, id))?.name || '',
  };
}

export function useAccountCandidates(id) {
  const { user } = useAuth();
  return useGuardianQuery(() => getAccountCandidates(id, user), [id], { enabled: !!id && !!user });
}
