import axios from 'axios';
import { USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { learningResourceMockRepository as mock } from './mock/learningResourceMockRepository';

// BE:EDU-81 — học liệu thuộc kế hoạch giáo dục ngày (dd_…); tệp ở kho S3 private (BE spec 017)
const base = (key) => `/education-plans/class-docs/day/${encodeURIComponent(key)}/learning-resources`;

export const learningResourceApi = {
  list: (_user, key) => axiosClient.get(base(key)),
  /** Tải thẳng lên kho qua liên kết có hạn rồi xác nhận; BE kiểm lại dung lượng + nội dung thật. */
  upload: async (_user, key, file, binding, requestId) => {
    const link = await axiosClient.post(`${base(key)}/upload-url`, {
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    });
    // Liên kết S3 đã ký: gọi bằng axios gốc (không gắn token/baseURL của BE — S3 từ chối khi có hai cách xác thực)
    await axios.put(link.url, file, { headers: link.headers, timeout: 600000 });
    return axiosClient.post(
      `${base(key)}/confirm`,
      { uploadId: link.uploadId, fileName: file.name, ...binding },
      { headers: { 'Idempotency-Key': requestId }, timeout: 120000 },
    );
  },
  detach: (_user, key, id) => axiosClient.delete(`${base(key)}/${id}`),
  /** Liên kết xem có hạn (~15 phút) để gắn thẳng vào img/video/object. */
  contentUrl: async (_user, key, id) => (await axiosClient.get(`${base(key)}/${id}/url`)).url,
};
export const learningResourceService = USE_MOCK ? mock : learningResourceApi;
