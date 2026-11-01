import { isDemoModule, sourceOf } from '@/services/demoSource';
import { guardianMockRepository as mock } from './mock/guardianMockRepository';
import { guardianApi as api } from './api/guardianApi';

/** Facade tài khoản phụ huynh; nguồn theo INTEGRATION_MODULES (api = BE GuardianController). */
const repo = sourceOf('guardian', mock, api);
const call = (method, ...args) => repo[method](...args);
// Mock: còn ô email (BE không lưu) và banner demo
export const IS_GUARDIAN_DEMO = isDemoModule('guardian');
export const listGuardians = (id, user) => call('listGuardians', id, user);
export const lookupGuardian = (childId, phone, user) => call('lookupGuardian', childId, phone, user);
export const addGuardian = (id, form, user) => call('addGuardian', id, form, user);
export const removeGuardian = (childId, id, user) => call('removeGuardian', childId, id, user);
export const updateParentStatus = (id, status, user) => call('updateParentStatus', id, status, user);
export const resetParentPassword = (id, user) => call('resetParentPassword', id, user);
export const getGuardianStructure = (user) => call('getStructure', user);
export const listAllChildrenForGuardians = async (campusId, user) => {
  const first = await call('searchChildren', { campusId, page: 0, size: 100 }, user);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) => call('searchChildren', { campusId, page: i + 1, size: 100 }, user)),
  );
  return [first, ...rest].flatMap((page) => page.items);
};
