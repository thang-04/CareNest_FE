import { beClient } from '@/services/http/beClient';
import { toWindowsRequest, validateWindowsForm } from '@/utils/kitchen/kitchenRecords';

/*
 * Bếp hôm nay, lưu mẫu thức ăn và ảnh bữa trên BE `/nutrition/kitchen/day`, `/food-samples`, `/meal-photos`,
 * `/meal-photo-windows`. Web chỉ xem và duyệt (bếp ghi qua App). Quyền duyệt (`canApprove`), trạng thái, số suất, lượng thực
 * phẩm do BE trả; BE kiểm lại quyền khi duyệt (403) và khi đặt khung giờ (chỉ Hiệu trưởng).
 */
const blank = (v) => v === '' || v == null;
const params = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !blank(v)));
const fieldError = (message, details) => Object.assign(new Error(message), { details });

// BE luôn trả đủ các mảng; chuẩn hóa để màn không phải kiểm null từng chỗ
const toKitchenDay = (day) => ({
  ...day,
  menu: day?.menu || [],
  servings: day?.servings || [],
  foods: day?.foods || [],
});
const toSample = (sample) => ({ ...sample, dishes: sample?.dishes || [] });

/** Factory để test thay client HTTP. */
export const createKitchenRecordsApi = ({ client = beClient } = {}) => ({
  /** Bếp hôm nay của một điểm trường; `date` bỏ trống = hôm nay theo BE. */
  async getKitchenDay({ campusId, date } = {}) {
    return toKitchenDay(await client.get('/nutrition/kitchen/day', { params: params({ campusId, date }) }));
  },

  /** Bản lưu mẫu của điểm trường trong khoảng ngày. */
  async listSamples({ campusId, from, to } = {}) {
    const samples = await client.get('/nutrition/food-samples', { params: params({ campusId, from, to }) });
    return (samples || []).map(toSample);
  },

  async approveSample(id) {
    return toSample(await client.post(`/nutrition/food-samples/${id}/approve`));
  },

  async approveDisposal(id) {
    return toSample(await client.post(`/nutrition/food-samples/${id}/approve-disposal`));
  },

  /** Ảnh bữa của điểm trường trong ngày (metadata); nội dung ảnh tải qua `getPhotoBlob`. */
  async listPhotos({ campusId, date } = {}) {
    return (await client.get('/nutrition/meal-photos', { params: params({ campusId, date }) })) || [];
  },

  /** Nội dung ảnh qua client có token (thẻ img không gửi được header Authorization). */
  async getPhotoBlob(photoId) {
    return client.getBlob(`/nutrition/meal-photos/${photoId}/content`);
  },

  /** Khung giờ đăng ảnh theo bữa, chung toàn trường: [{ session, startTime, endTime }]. */
  async getWindows() {
    return (await client.get('/nutrition/meal-photo-windows')) || [];
  },

  /** Hiệu trưởng đặt khung giờ; form là ô nhập từng bữa (`windowsToForm`). Chặn giờ sai định dạng/đảo ngược trước khi gửi. */
  async saveWindows(form) {
    const details = validateWindowsForm(form);
    if (Object.keys(details).length) throw fieldError('Kiểm tra lại khung giờ đã nhập', details);
    const body = toWindowsRequest(form);
    if (!body.windows.length) throw fieldError('Nhập khung giờ cho ít nhất một bữa', { _form: 'Nhập khung giờ cho ít nhất một bữa' });
    return (await client.put('/nutrition/meal-photo-windows', body)) || [];
  },
});

export const kitchenRecordsApi = createKitchenRecordsApi();
