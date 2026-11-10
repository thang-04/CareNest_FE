import { forwardRef } from 'react';
import { PrintHeader } from '@/components/print/PrintHeader';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { formatDate, formatWeekdayDate } from '@/utils/format';

const OrderTable = ({ rows, needLabel }) => (
  <table className="ps-table">
    <thead>
      <tr>
        <th>STT</th>
        <th>Thực phẩm</th>
        <th>Số lượng</th>
        <th>Đơn vị</th>
        {needLabel && <th>{needLabel}</th>}
        <th>Ghi chú nhà cung cấp</th>
      </tr>
    </thead>
    <tbody>
      {rows.map((row, i) => (
        <tr key={row.food.id}>
          <td className="c">{i + 1}</td>
          <td>{row.food.name}</td>
          <td className="c">{fmtQty(row.qty)}</td>
          <td className="c">{row.food.purchaseUnit}</td>
          {needLabel && <td className="c">{row.need}</td>}
          <td className="kb-print-note" />
        </tr>
      ))}
    </tbody>
  </table>
);

/**
 * Danh sách đặt hàng A4 (mẫu `.print-sheet`) của một bản dự trù: hàng tươi tổng cả kỳ và hàng khô cần nhập thêm, theo đơn
 * vị mua; cột ghi chú nhà cung cấp để trống. Phần nào không có dòng thì bỏ.
 */
export const FreshForecastPrint = forwardRef(function FreshForecastPrint({ forecast, campusName }, ref) {
  const fresh = forecast.lines.map((line) => ({ food: line.food, qty: line.purchaseTotal }));
  const dry = forecast.dryLines.map((line) => ({
    food: line.food,
    qty: line.purchaseShortQty,
    need: formatWeekdayDate(line.shortFrom),
  }));
  return (
    <div className="print-sheet" ref={ref}>
      <PrintHeader />
      <div className="ps-title">
        <h1>DANH SÁCH ĐẶT HÀNG</h1>
        <div>
          Từ {formatDate(forecast.periodFrom)} đến {formatDate(forecast.periodTo)}
          {campusName ? ` · ${campusName}` : ''}
        </div>
      </div>
      {forecast.note && <p>Ghi chú: {forecast.note}</p>}
      {fresh.length > 0 && (
        <>
          <h2 className="ps-section">Hàng tươi</h2>
          <OrderTable rows={fresh} />
        </>
      )}
      {dry.length > 0 && (
        <>
          <h2 className="ps-section">Hàng khô cần nhập thêm</h2>
          <OrderTable rows={dry} needLabel="Cần trước" />
        </>
      )}
    </div>
  );
});
