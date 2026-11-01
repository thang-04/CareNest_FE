import { downloadCsv } from '@/utils/exportCsv';
export { exportElementToPdf } from '@/utils/exportPdf';
import { formatDate, formatDateTime } from '@/utils/format';

/** CSV with UTF-8 BOM so Excel shows Vietnamese correctly. */
export const exportPrintModelToCsv = (model, filename) => {
  const rows = [
    ['PHIẾU LUÂN CHUYỂN TÀI SẢN'],
    ['Số phiếu', model.code],
    ['Trạng thái', model.statusLabel],
    ['Ngày lập', formatDate(model.createdDate)],
    ['Ngày dự kiến bàn giao', formatDate(model.expectedHandoverDate)],
    ['Loại luân chuyển', model.typeLabel],
    ['Từ', model.from],
    ['Đến', model.to],
    ['Lý do', model.reason],
    ['Ghi chú', model.note],
    [],
    ['STT', 'Mã tài sản', 'Tên tài sản', 'Đơn vị', 'Số lượng theo phiếu', 'SL bàn giao', 'SL thực nhận'],
    ...model.items.map((i) => [i.stt, i.code, i.name, i.unit, i.quantity, i.handoverQuantity ?? '', i.receivedQuantity ?? '']),
    [
      '',
      '',
      'Tổng cộng',
      '',
      model.total,
      model.showHandoverColumn ? model.totalHandover : '',
      model.showReceivedColumn ? model.totalReceived : '',
    ],
    [],
    ['Chữ ký', 'Họ tên', 'Trạng thái', 'Thời gian ký'],
    ...model.signers.map((s) => [s.title, s.name, s.signed ? 'Đã ký' : 'Chưa xác nhận', s.signedAt ? formatDateTime(s.signedAt) : '']),
  ];
  downloadCsv(rows, filename);
};
