import { axiosClient } from '@/services/http/axiosClient';
import { cachedBlobUrl } from '@/services/http/blobUrlCache';
import { mapDay, mapSheet, mapSupplier, toApiTab } from '@/services/kitchen/api/inspectionMapper';

/*
 * Biên bản kiểm thực ba bước M1–M3 và soát sổ lưu mẫu M5 (INS-01..04): contract ở BE `docs/modules/nutrition.md`. Cùng tên hàm và
 * tham số với mock; BE trả `{ sheets[] }` nên bản trả được đổi sang shape màn hình ở `inspectionMapper`. Quyền ghi/ký
 * (`canEdit`) do BE trả; người dùng lấy từ token.
 */

/** Ảnh chữ ký trên biên bản cần token ⇒ tải blob rồi dùng object URL; `campusId` để BE kiểm phạm vi điểm trường. */
const imageLoader = (campusId) => (imageKey) =>
  cachedBlobUrl(`inspection:${campusId}:${imageKey}`, () =>
    axiosClient.get(`/inspections/signatures/${imageKey}`, { params: { campusId }, responseType: 'blob' }),
  );

const params = ({ campusId, date }) => ({ params: { campusId, date } });

export const inspectionApi = {
  getInspectionDay: async ({ campusId, date }) =>
    mapDay(await axiosClient.get('/inspections/day', { params: { campusId, date } }), imageLoader(campusId)),
  /**
   * `header` = { place, checkedAt }, `rows` = [{ key, ...ô nhập }], `version` = phiên bản đang sửa (0 khi chưa lưu);
   * lệch phiên bản ⇒ 409 vì có người lưu trước.
   */
  saveInspectionTab: async ({ campusId, date, tab, header, rows, version }) => {
    const sheet = await axiosClient.put(
      `/inspections/day/${toApiTab(tab)}`,
      { expectedVersion: version ?? 0, header, rows },
      params({ campusId, date }),
    );
    return { version: sheet.version, status: sheet.status };
  },
  /** Nhà cung cấp đang dùng (danh mục bán trú) để điền nhanh "Nơi cung cấp". */
  getInspectionSuppliers: async () => (await axiosClient.get('/nutrition/suppliers', { params: { status: 'ACTIVE' } })).map(mapSupplier),
  /** Mở khóa mẫu đã ký để sửa: bắt buộc `reason` (≥ 3 ký tự); BE đưa chữ ký cũ vào lịch sử. */
  reopenInspectionTab: async ({ campusId, date, tab, reason }) => {
    const sheet = await axiosClient.post(`/inspections/day/${toApiTab(tab)}/reopen`, { reason }, params({ campusId, date }));
    return { status: sheet.status };
  },
  /** BE chép ảnh chữ ký của tài khoản vào mẫu lúc ký; chỉ gửi id chữ ký đã lưu (bỏ trống ⇒ chữ ký mặc định). */
  signInspectionTab: async ({ campusId, date, tab, signatureId }) => {
    const sheet = await axiosClient.post(`/inspections/day/${toApiTab(tab)}/sign`, { signatureId }, params({ campusId, date }));
    const mapped = await mapSheet(sheet, { canEdit: true, loadImage: imageLoader(campusId) });
    return { status: mapped.status, signature: mapped.signature };
  },
};
