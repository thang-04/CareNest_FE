import { sourceOf } from '@/services/demoSource';
import { phoneChangeApi } from '@/services/account/api/phoneChangeApi';
import { phoneChangeMock } from '@/mocks/phoneChangeMock';

const repo = sourceOf('guardian', phoneChangeMock, phoneChangeApi);
export const requestPhoneChange = (childId, guardianId, body, user) => repo.requestPhoneChange(childId, guardianId, body, user);
export const listPhoneChangeRequests = (status, user) => repo.listPhoneChangeRequests(status, user);
export const approvePhoneChange = (id, user) => repo.approvePhoneChange(id, user);
export const rejectPhoneChange = (id, note, user) => repo.rejectPhoneChange(id, note, user);
