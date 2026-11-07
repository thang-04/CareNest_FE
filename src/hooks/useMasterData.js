import { useMemo } from 'react';
import { useAsync } from './useAsync';
import { useAuth } from '@/contexts/AuthContext';
import { getCampuses, getLocations, getUsers } from '@/services/masterDataService';

/** Campuses, locations, users and categories + lookup helpers. */
export function useMasterData() {
  const { user } = useAuth() || {};
  const { data, loading, error, reload } = useAsync(async () => {
    const [campuses, locations, users] = await Promise.all([getCampuses(user), getLocations(user), getUsers(user)]);
    return { campuses, locations, users };
  }, [user?.id, user?.role]);

  return useMemo(() => {
    const campuses = data?.campuses || [];
    const locations = data?.locations || [];
    const users = data?.users || [];

    const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
    const campusMap = byId(campuses);
    const locationMap = byId(locations);
    const userMap = byId(users);

    return {
      loading,
      error,
      reload,
      campuses,
      locations,
      users,
      campusById: (id) => campusMap[id],
      locationById: (id) => locationMap[id],
      userById: (id) => userMap[id],
    };
  }, [data, loading, error, reload]);
}
