import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolYear } from '@/contexts/SchoolYearContext';
import { useAsync } from '@/hooks/useAsync';
import { ROLES } from '@/models/User';
import { getCampusList } from '@/services/schoolService';
import { inBePermissionScope } from '@/utils/bePermissions';

/**
 * Điểm trường của năm học đang chọn cho ô lọc (BE V151: mỗi năm có danh sách riêng), đủ cả điểm trường chưa có lớp.
 * Hiệu trưởng: cả danh sách. PHT: điểm trường trong phạm vi HT cấp cho mã quyền của màn (SCHOOL = cả danh sách,
 * 1 điểm trường thì ô lọc tự ẩn). Người khác hoặc màn không truyền mã quyền (PHT): null, ô lọc theo lớp mình xem.
 * BE vẫn kiểm tra phạm vi khi lọc theo campusId.
 */
export function useYearCampuses(permission) {
  const { user } = useAuth();
  const { schoolYear } = useSchoolYear();
  const principal = user?.role === ROLES.PRINCIPAL;
  const vice = user?.role === ROLES.VICE_PRINCIPAL && !!permission;
  const { data } = useAsync(() => getCampusList(schoolYear, user), [schoolYear, user?.id], { enabled: principal || vice });
  return useMemo(() => {
    if (!data || !(principal || vice)) return null;
    return principal ? data : data.filter((c) => inBePermissionScope(user, permission, c.id));
  }, [data, principal, vice, user, permission]);
}
