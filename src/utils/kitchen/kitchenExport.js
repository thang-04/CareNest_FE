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

/** Bảng đi chợ một ngày: dòng thực phẩm như trên màn, rồi thu–chi và thực đơn theo bữa. */
export const dayMarketCsvRows = (data) => {
  const groupOf = (row, id) => row.groups.find((g) => g.ageGroupId === id);
  return [
    [`Bảng đi chợ ngày ${formatDate(data.date)} · ${data.campusName}`],
    [
      'STT',
      'Thực phẩm',
      'Đơn vị',
      'Đơn giá',
      'Xuất kho',
      'Mua chợ',
      'Thành tiền',
      ...data.groups.flatMap((g) => [`${g.name} · số lượng`, `${g.name} · tiền`]),
    ],
    ...data.lines.map((l, i) => [
      i + 1,
      l.name,
      l.unit,
      l.unitPrice ?? '',
      l.source === 'STOCK' ? l.quantity : '',
      l.source === 'MARKET' ? l.quantity : '',
      l.amount ?? '',
      ...l.groups.flatMap((g) => [g.quantity || '', g.amount ?? '']),
    ]),
    ['', 'Tổng chi', '', '', '', '', data.totals.cost, ...data.totals.groups.flatMap((g) => ['', g.cost])],
    [],
    ['Thu – chi trong ngày'],
    ['Nhóm tuổi', 'Số suất', 'Giá một suất', 'Thu'],
    ...data.groups.map((g) => [g.name, g.servings, g.price ?? '', g.revenue ?? '']),
    ['Tổng thu', data.totals.servings, '', data.totals.revenue],
    ['Chi mua chợ', '', '', data.totals.marketCost],
    ['Chi xuất kho', '', '', data.totals.stockCost],
    ['Tổng chi', '', '', data.totals.cost],
    [data.totals.balance >= 0 ? 'Còn thừa' : 'Còn thiếu', '', '', Math.abs(data.totals.balance)],
    [],
    ['Thực đơn trong ngày'],
    ['Bữa', ...data.groups.map((g) => g.name)],
    ...data.menu.map((m) => [m.name, ...data.groups.map((g) => (groupOf(m, g.ageGroupId)?.dishes || []).join('; '))]),
  ];
};

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
