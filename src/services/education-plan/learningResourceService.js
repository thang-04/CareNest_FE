import axios from 'axios';
import { USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { learningResourceMockRepository as mock } from './mock/learningResourceMockRepository';

// BE:EDU-81/82 — dòng gắn học liệu của kế hoạch giáo dục ngày (dd_…); tệp ở kho S3 private (BE spec 017), học liệu ở kho (spec 900)
const base = (key) => `/education-plans/class-docs/day/${encodeURIComponent(key)}/learning-resources`;

export const learningResourceApi = {
  list: (_user, key) => axiosClient.get(base(key)),
  /**
   * Tải thẳng lên kho qua liên kết có hạn rồi xác nhận; BE kiểm lại dung lượng + nội dung thật, tạo học liệu + dòng gắn.
   * title = tên học liệu người dùng đặt; trống ⇒ BE lấy tên tệp bỏ đuôi.
   */
  upload: async (_user, key, file, binding, requestId, tags, title) => {
    const link = await axiosClient.post(`${base(key)}/upload-url`, {
      fileName: file.name,
      contentType: file.type,
      size: file.size,
    });
    // Liên kết S3 đã ký: gọi bằng axios gốc (không gắn token/baseURL của BE — S3 từ chối khi có hai cách xác thực)
    await axios.put(link.url, file, { headers: link.headers, timeout: 600000 });
    return axiosClient.post(
      `${base(key)}/confirm`,
      { uploadId: link.uploadId, fileName: file.name, title: title || undefined, ...binding, tags },
      { headers: { 'Idempotency-Key': requestId }, timeout: 120000 },
    );
  },
  /** BE:EDU-83 — dán link YouTube/Google vào một mục. */
  addLink: (_user, key, body) => axiosClient.post(`${base(key)}/links`, body),
  /** BE:EDU-82 — gắn học liệu có sẵn trong kho. */
  attach: (_user, key, body) => axiosClient.post(`${base(key)}/attach`, body),
  detach: (_user, key, id) => axiosClient.delete(`${base(key)}/${id}`),
  /** BE:EDU-82 — thứ tự mới của mọi dòng gắn trong một mục ({ activityKey, ids }). */
  reorder: (_user, key, body) => axiosClient.put(`${base(key)}/order`, body),
  /** Liên kết xem có hạn (~15 phút) để gắn thẳng vào img/video/object; học liệu link trả url gốc. */
  contentUrl: async (_user, key, id) => (await axiosClient.get(`${base(key)}/${id}/url`)).url,
};
export const learningResourceService = USE_MOCK ? mock : learningResourceApi;
