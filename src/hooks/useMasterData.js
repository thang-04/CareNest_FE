import { useMemo } from 'react';
import { useAsync } from './useAsync';
import { useAuth } from '@/contexts/AuthContext';
import { getAssetCategories, getCampuses, getLocations, getUsers } from '@/services/masterDataService';

/** Campuses, locations, users and categories + lookup helpers. */
export function useMasterData() {
  const { user } = useAuth() || {};
  const { data, loading, error, reload } = useAsync(async () => {
    const [campuses, locations, users, categories] = await Promise.all([
      getCampuses(user),
      getLocations(user),
      getUsers(user),
      getAssetCategories(),
    ]);
    return { campuses, locations, users, categories };
  }, [user?.id, user?.role]);

  return useMemo(() => {
    const campuses = data?.campuses || [];
    const locations = data?.locations || [];
    const users = data?.users || [];
    const categories = data?.categories || [];
    const byId = (list) => Object.fromEntries(list.map((x) => [x.id, x]));
    const campusMap = byId(campuses);
    const locationMap = byId(locations);
    const userMap = byId(users);
    const categoryMap = byId(categories);
    return {
      loading,
      error,
      reload,
      campuses,
      locations,
      users,
      categories,
      campusById: (id) => campusMap[id],
      locationById: (id) => locationMap[id],
      userById: (id) => userMap[id],
      categoryById: (id) => categoryMap[id],
    };
  }, [data, loading, error, reload]);
}
