import { useAuth } from '@/contexts/AuthContext';
import { useGuardianQuery } from '@/hooks/account/useGuardianQuery';
import { listAllChildrenForGuardians, listGuardians, getGuardianStructure } from '@/services/account/guardianService';
export function useChildGuardians(id) {
  const { user } = useAuth();
  return useGuardianQuery(() => listGuardians(id, user), [id], { enabled: !!id && !!user });
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
    campusName: (id) => campuses.find((row) => row.id === id)?.name || '',
    classroomName: (id) => classrooms.find((row) => row.id === id)?.name || '',
  };
}
