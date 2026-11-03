import { forwardRef } from 'react';
import { PrintHeader } from '@/components/print/PrintHeader';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { formatDate } from '@/utils/format';

/** Danh sách đặt hàng tươi A4 (mẫu `.print-sheet`): thực phẩm, tổng số lượng theo đơn vị mua, cột ghi chú nhà cung cấp để trống. */
export const FreshForecastPrint = forwardRef(function FreshForecastPrint({ forecast, campusName }, ref) {
  return (
    <div className="print-sheet" ref={ref}>
      <PrintHeader />
      <div className="ps-title">
        <h1>DANH SÁCH ĐẶT HÀNG TƯƠI</h1>
        <div>
          Từ {formatDate(forecast.periodFrom)} đến {formatDate(forecast.periodTo)}
          {campusName ? ` · ${campusName}` : ''}
        </div>
      </div>
      {forecast.note && <p>Ghi chú: {forecast.note}</p>}
      <table className="ps-table">
        <thead>
          <tr>
            <th>STT</th>
            <th>Thực phẩm</th>
            <th>Số lượng</th>
            <th>Đơn vị</th>
            <th>Ghi chú nhà cung cấp</th>
          </tr>
        </thead>
        <tbody>
          {forecast.lines.map((line, i) => (
            <tr key={line.food.id}>
              <td className="c">{i + 1}</td>
              <td>{line.food.name}</td>
              <td className="c">{fmtQty(line.purchaseTotal)}</td>
              <td className="c">{line.food.purchaseUnit}</td>
              <td className="kb-print-note" />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
