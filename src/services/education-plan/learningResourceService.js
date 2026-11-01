import { USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { learningResourceMockRepository as mock } from './mock/learningResourceMockRepository';

const base = (key) => `/education-plans/class-docs/theme/${encodeURIComponent(key)}/learning-resources`;
export const learningResourceApi = {
  list: (_user, key) => axiosClient.get(base(key)),
  upload: (_user, key, file, binding, requestId) => {
    const data = new FormData();
    data.append('file', file);
    Object.entries(binding).forEach(([k, v]) => data.append(k, v));
    return axiosClient.post(base(key), data, { headers: { 'Content-Type': undefined, 'Idempotency-Key': requestId }, timeout: 120000 });
  },
  bind: (_user, key, id, binding) => axiosClient.patch(`${base(key)}/${id}/activity`, binding),
  detach: (_user, key, id) => axiosClient.delete(`${base(key)}/${id}`),
  content: (_user, key, id, signal) => axiosClient.get(`${base(key)}/${id}/content`, { responseType: 'blob', signal, timeout: 120000 }),
};
export const learningResourceService = USE_MOCK ? mock : learningResourceApi;
