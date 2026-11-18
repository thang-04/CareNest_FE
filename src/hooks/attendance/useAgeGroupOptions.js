import { useMemo } from 'react';
import { useAgeGroups } from '@/hooks/useSchool';

/** Nhóm tuổi có lớp trong danh sách lớp đang xem (lọc theo nhóm tuổi ở màn điểm danh, đơn nghỉ, sổ báo ăn). */
export function useAgeGroupOptions(classes) {
  const { ageGroups } = useAgeGroups();
  return useMemo(() => {
    const present = new Set((classes || []).map((c) => String(c.ageGroupId ?? '')).filter(Boolean));
    return ageGroups.filter((g) => present.has(String(g.id))).map((g) => ({ id: String(g.id), name: g.shortName || g.name }));
  }, [ageGroups, classes]);
}
