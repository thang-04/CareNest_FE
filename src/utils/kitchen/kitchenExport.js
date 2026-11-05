import { formatDate, formatDateTime } from '@/utils/format';
import { MEAL_SESSION_LABELS, SAMPLE_DISPOSAL_LABELS, SAMPLE_STATUS_LABELS } from '@/models/kitchen/kitchenRecordConstants';

/*
 * Dòng CSV cho nút "Xuất Excel" ở các màn bếp (downloadCsv). Chỉ chép lại số service đã trả, không tính thêm.
 */

/** Phiếu đặt hàng tuần: phần hàng tươi theo ngày, một dòng trống, rồi phần đồ khô cần mua. */
export const weeklyOrderCsvRows = (data) => [
  ['Hàng tươi · giao theo ngày'],
  ['Thực phẩm', 'ĐVT', ...data.days.map((d) => formatDate(d.date)), 'Cộng'],
  ...data.fresh.map((f) => [f.name, f.unit, ...f.days.map((x) => x.qty || ''), f.total]),
  [],
  ['Đồ khô cần mua'],
  ['Thực phẩm', 'ĐVT', 'Cần cho tuần', 'Tồn kho', 'Cần mua'],
  ...data.dry.map((f) => [f.name, f.unit, f.need, f.stock, f.toBuy > 0 ? f.toBuy : '']),
];

/** Sổ lưu mẫu thức ăn: mỗi bản lưu mẫu một dòng, như bảng trên màn. */
export const foodSampleCsvRows = (samples) => [
  ['Ngày', 'Bữa ăn', 'Món lưu mẫu', 'Ghi chú', 'Lấy mẫu lúc', 'Lưu mẫu', 'Hủy mẫu', 'Hủy lúc'],
  ...samples.map((s) => [
    formatDate(s.date),
    MEAL_SESSION_LABELS[s.session] || s.session,
    s.dishes.map((d) => d.name).join('; '),
    s.note || '',
    formatDateTime(s.sampledAt),
    SAMPLE_STATUS_LABELS[s.status] || s.status,
    SAMPLE_DISPOSAL_LABELS[s.disposalStatus] || s.disposalStatus,
    s.disposedAt ? formatDateTime(s.disposedAt) : '',
  ]),
];
