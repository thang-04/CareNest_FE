import { forwardRef } from 'react';
import { DataTable } from '@/components';
import { PrintHeader } from '@/components/print/PrintHeader';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { HANDLING_LABELS } from '@/utils/kitchen/freshHandling';
import { formatDate } from '@/utils/format';

const COLUMNS = [
  { key: 'no', header: 'STT', className: 'c', render: (r) => r.no },
  { key: 'name', header: 'Thực phẩm', render: (r) => r.food.name },
  { key: 'supplier', header: 'Nhà cung cấp', render: (r) => r.supplier },
  { key: 'action', header: 'Xử lý', className: 'c', render: (r) => HANDLING_LABELS[r.action] },
  { key: 'quantity', header: 'Số lượng', className: 'c', render: (r) => fmtQty(r.quantity) },
  { key: 'unit', header: 'Đơn vị', className: 'c', render: (r) => r.food.purchaseUnit },
  { key: 'note', header: 'Ghi chú', className: 'kb-print-note', render: (r) => r.note },
];

/** Phiếu chênh lệch A4 gửi nhà cung cấp: hàng gọi thêm và hàng trả lại của một điểm trường trong ngày. */
export const FreshHandlingSlip = forwardRef(function FreshHandlingSlip({ rows, date, campusName }, ref) {
  return (
    <div className="print-sheet" ref={ref}>
      <PrintHeader />
      <div className="ps-title">
        <h1>PHIẾU CHÊNH LỆCH HÀNG TƯƠI</h1>
        <div>
          Ngày {formatDate(date)}
          {campusName ? ` · ${campusName}` : ''}
        </div>
      </div>
      <DataTable className="ps-table" columns={COLUMNS} rows={rows.map((row, i) => ({ ...row, no: i + 1, id: row.food.id }))} />
    </div>
  );
});
