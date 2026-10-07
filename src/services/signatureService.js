import { USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { signatureMockRepository } from '@/mocks/signatureMockRepository';

/** Signatures saved on the current account (reused by every module that signs documents). */
const api = {
  listMine: () => axiosClient.get('/signatures/me'),
  save: (_user, body) => axiosClient.post('/signatures/me', body),
  setDefault: (_user, id) => axiosClient.patch(`/signatures/me/${id}/default`),
  remove: (_user, id) => axiosClient.delete(`/signatures/me/${id}`),
};

const repo = USE_MOCK ? signatureMockRepository : api;

export const getMySignatures = (user) => repo.listMine(user);
export const saveSignature = (user, body) => repo.save(user, body);
export const setDefaultSignature = (user, id) => repo.setDefault(user, id);
export const deleteSignature = (user, id) => repo.remove(user, id);
