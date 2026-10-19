import { readDb, clone, delay, ApiError } from '@/mocks/mockDatabase';
import { canAccessCampus, canViewKitchenDay } from '@/utils/kitchen/kitchenPermissions';

// Các widget cũ chỉ đọc lịch sử, không khởi tạo lại luồng chế biến/báo thiếu đã thay thế.
export const readLegacyKitchenRows = async (collection, { campusId, date, status }, user) => {
  await delay();
  if (!canViewKitchenDay(user) || !campusId || !canAccessCampus(user, campusId))
    throw new ApiError(403, 'Bạn không có quyền xem dữ liệu bếp của điểm trường này.');
  return clone(
    (readDb()[collection] || []).filter(
      (row) => row.campusId === campusId && (!date || row.date === date) && (!status || status === 'ALL' || row.status === status),
    ),
  );
};
