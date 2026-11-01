import { forwardRef } from 'react';
import { PrintHeader } from '@/components/print/PrintHeader';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { dayShort, weekLabel } from '@/components/kitchen/ForecastBlocks';

/** Phiếu đặt hàng tuần A4 (mẫu `.print-sheet`): hàng tươi theo ngày giao, đồ khô cần mua, chữ ký. */
export const WeeklyOrderPrint = forwardRef(function WeeklyOrderPrint({ data, campusName }, ref) {
  const days = data.days.filter((d) => !d.holiday);
  const toBuy = data.dry.filter((f) => f.toBuy > 0);
  return (
    <div className="print-sheet" ref={ref}>
      <PrintHeader />
      <div className="ps-title">
        <h1>PHIẾU ĐẶT HÀNG TUẦN</h1>
        <div>
          Tuần {weekLabel(data.days)}
          {campusName ? ` · ${campusName}` : ''}
        </div>
      </div>
      <div className="ps-section">Hàng tươi giao theo ngày</div>
      <table className="ps-table">
        <thead>
          <tr>
            <th>STT</th>
            <th>Thực phẩm</th>
            <th>ĐVT</th>
            {days.map((d) => (
              <th key={d.date}>{dayShort(d.date)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={3}>Số suất dự kiến</td>
            {days.map((d) => (
              <td key={d.date} className="c">
                {d.total}
              </td>
            ))}
          </tr>
          {data.fresh.map((f, i) => (
            <tr key={f.foodId}>
              <td className="c">{i + 1}</td>
              <td>{f.name}</td>
              <td className="c">{f.unit}</td>
              {f.days
                .filter((x) => days.some((d) => d.date === x.date))
                .map((x) => (
                  <td key={x.date} className="c">
                    {x.qty ? fmtQty(x.qty) : ''}
                  </td>
                ))}
            </tr>
          ))}
        </tbody>
      </table>
      {toBuy.length > 0 && (
        <>
          <div className="ps-section">Đồ khô cần mua</div>
          <table className="ps-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Thực phẩm</th>
                <th>ĐVT</th>
                <th>Số lượng</th>
              </tr>
            </thead>
            <tbody>
              {toBuy.map((f, i) => (
                <tr key={f.foodId}>
                  <td className="c">{i + 1}</td>
                  <td>{f.name}</td>
                  <td className="c">{f.unit}</td>
                  <td className="c">{fmtQty(f.toBuy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <table className="ps-table ps-sign kb-print-sign">
        <tbody>
          <tr>
            {['Người lập', 'Nhà cung cấp', 'Hiệu trưởng'].map((t) => (
              <td key={t}>
                <div className="ps-sign__title">{t}</div>
                <div className="ps-sign__role">(Ký, ghi rõ họ tên)</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
});
