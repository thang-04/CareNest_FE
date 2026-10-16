import { forwardRef } from 'react';
import { PrintHeader } from '@/components/print/PrintHeader';
import { formatDate } from '@/utils/format';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const num = (n) => Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/** Phiếu đi chợ A4 (mẫu `.print-sheet`): số suất theo nhóm tuổi, lượng mua theo ĐVT, thành tiền, chữ ký. */
export const MarketSheetPrint = forwardRef(function MarketSheetPrint({ data, campusName }, ref) {
  const servings = data.revenue.parts.map((p) => `${p.name} ${p.servings} suất`).join(' · ');
  return (
    <div className="print-sheet" ref={ref}>
      <PrintHeader />
      <div className="ps-title">
        <h1>PHIẾU ĐI CHỢ</h1>
        <div>
          Ngày {formatDate(data.date)}
          {campusName ? ` · ${campusName}` : ''}
          {servings ? ` · ${servings}` : ''}
        </div>
      </div>
      <table className="ps-table">
        <thead>
          <tr>
            <th>STT</th>
            <th>Thực phẩm</th>
            <th>Lượng mua</th>
            <th>Đơn giá</th>
            <th>Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          {data.foods.map((f, i) => (
            <tr key={f.foodId}>
              <td className="c">{i + 1}</td>
              <td>{f.name}</td>
              <td className="c">
                {num(f.buyUnits)} {f.purchaseUnit}
              </td>
              <td className="c">{f.unitPrice == null ? '' : formatMoney(f.unitPrice)}</td>
              <td className="c">{f.amount == null ? '' : formatMoney(f.amount)}</td>
            </tr>
          ))}
          <tr className="ps-total">
            <td colSpan={4}>Cộng</td>
            <td className="c">{formatMoney(data.cost.total)}</td>
          </tr>
        </tbody>
      </table>
      {data.substitutes.length > 0 && (
        <>
          <div className="ps-section">Suất thay thế dị ứng</div>
          <table className="ps-table">
            <tbody>
              {data.substitutes.map((s) => (
                <tr key={`${s.original}-${s.replacement}`}>
                  <td>
                    {s.original} → {s.replacement || 'bỏ món'}
                  </td>
                  <td className="c">{s.servings} suất</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <table className="ps-table ps-sign kb-print-sign">
        <tbody>
          <tr>
            {['Người lập', 'Bếp trưởng', 'Hiệu trưởng'].map((t) => (
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
