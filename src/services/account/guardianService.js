import { USE_MOCK } from '@/config/env';
import { guardianMockRepository } from '@/services/account/mock/guardianMockRepository';
import { guardianApi } from '@/services/account/api/guardianApi';

/** Facade tài khoản phụ huynh: UI chỉ gọi các hàm này. Mật khẩu tạm trả về chỉ để in phiếu, không lưu. */
const repo = USE_MOCK ? guardianMockRepository : guardianApi;

export const listGuardians = (childId, user) => repo.listGuardians(childId, user);
export const addGuardian = (childId, form, user) => repo.addGuardian(childId, form, user);
export const removeGuardian = (childId, userId, user) => repo.removeGuardian(childId, userId, user);
export const updateParentStatus = (userId, status, user) => repo.updateParentStatus(userId, status, user);
export const resetParentPassword = (userId, user) => repo.resetParentPassword(userId, user);

// BE trả tối đa 100 trẻ một trang; gộp đủ các trang của một điểm trường để đếm theo lớp
const PAGE_MAX = 100;
export const listAllChildrenForGuardians = async (campusId, user) => {
  const first = await repo.searchChildren({ campusId, page: 0, size: PAGE_MAX }, user);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) =>
      repo.searchChildren({ campusId, page: i + 1, size: PAGE_MAX }, user),
    ),
  );
  return [first, ...rest].flatMap((p) => p.items);
};
