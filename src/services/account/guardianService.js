import { USE_MOCK } from '@/config/env';
import { guardianMockRepository as mock } from './mock/guardianMockRepository';
const call = (method, ...args) => USE_MOCK ? mock[method](...args) : Promise.reject({ status: 501, message: 'Giao diện tài khoản phụ huynh đang demo; cần thống nhất contract BE.' });
export const listGuardians = (id, user) => call('listGuardians', id, user);
export const addGuardian = (id, form, user) => call('addGuardian', id, form, user);
export const removeGuardian = (childId, id, user) => call('removeGuardian', childId, id, user);
export const updateParentStatus = (id, status, user) => call('updateParentStatus', id, status, user);
export const resetParentPassword = (id, user) => call('resetParentPassword', id, user);
export const getGuardianStructure = (user) => call('getStructure', user);
export const listAllChildrenForGuardians = async (campusId, user) => {
  const first = await call('searchChildren', { campusId, page: 0, size: 100 }, user);
  const rest = await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, i) => call('searchChildren', { campusId, page: i + 1, size: 100 }, user)));
  return [first, ...rest].flatMap((page) => page.items);
};
