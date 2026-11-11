import { isDemoModule, sourceOf } from '@/services/demoSource';
import { guardianMockRepository as mock } from './mock/guardianMockRepository';
import { guardianApi as api } from './api/guardianApi';

/** Facade tài khoản phụ huynh; nguồn theo INTEGRATION_MODULES (api = BE GuardianController). */
const repo = sourceOf('guardian', mock, api);
const call = (method, ...args) => repo[method](...args);
// Mock: còn ô email (BE không lưu) và banner demo
export const IS_GUARDIAN_DEMO = isDemoModule('guardian');
export const listGuardians = (id, user) => call('listGuardians', id, user);
export const listPendingGuardians = (childId, user) => call('listPendingGuardians', childId, user);
export const activateGuardians = (childId, user, guardianId) => call('activateGuardians', childId, user, guardianId);
export const getAccountCandidates = (childId, user) => call('getAccountCandidates', childId, user);
export const selectAccountRecipient = (childId, guardianId, user) => call('selectAccountRecipient', childId, guardianId, user);
/**
 * Hộp thoại kích hoạt (AUTH-18): kích hoạt cho phụ huynh đang chọn ở dropdown. Khác người nhận đã lưu thì lưu người nhận
 * trước rồi mới kích hoạt (hai API có sẵn); bước kích hoạt lỗi thì người nhận đã là người vừa chọn, bấm lại là xong.
 */
export const activateChosenGuardian = async (childId, guardianId, savedRecipientId, user) => {
  if (String(guardianId) !== String(savedRecipientId)) await selectAccountRecipient(childId, guardianId, user);
  return activateGuardians(childId, user, guardianId);
};
export const lookupGuardian = (childId, phone, user) => call('lookupGuardian', childId, phone, user);
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
