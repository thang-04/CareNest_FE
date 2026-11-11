import { forwardRef } from 'react';
import { PrintHeader } from '@/components/print/PrintHeader';
import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { DishLines, groupCell } from '@/components/kitchen/DayMarketBlocks';
import { formatDate } from '@/utils/format';

const num = (n) => (n == null ? '' : Math.round(n).toLocaleString('vi-VN'));
const qty = (n) => (n ? fmtQty(n) : '');

/** Bảng đi chợ một ngày, A4 ngang (mẫu `.print-sheet`): thực phẩm, thu–chi, thực đơn theo bữa, ba ô ký tay. */
export const DayMarketPrint = forwardRef(function DayMarketPrint({ data }, ref) {
  const { totals, groups } = data;
  return (
    <div className="print-sheet print-sheet--landscape" ref={ref}>
      <PrintHeader />
      <div className="ps-title">
        <h1>BẢNG ĐI CHỢ</h1>
        <div>
          Ngày {formatDate(data.date)} · {data.campusName}
          {data.basis === 'FORECAST' ? ' · theo số trẻ đang học, chưa chốt suất' : ''}
        </div>
      </div>
      <p>
        Tổng số suất ăn: {totals.servings}
        {groups.map((g) => ` · ${g.name}: ${g.servings} suất${g.price == null ? '' : ` × ${num(g.price)} đ`}`)}
      </p>
      <table className="ps-table">
        <thead>
          <tr>
            <th rowSpan={2}>STT</th>
            <th rowSpan={2}>Tên thực phẩm</th>
            <th rowSpan={2}>Đơn vị</th>
            <th rowSpan={2}>Đơn giá</th>
            <th colSpan={2}>Số lượng</th>
            <th rowSpan={2}>Thành tiền</th>
            {groups.map((g) => (
              <th key={g.ageGroupId} colSpan={2}>
                {g.name}
              </th>
            ))}
          </tr>
          <tr>
            <th>Xuất kho</th>
            <th>Mua chợ</th>
            {groups.flatMap((g) => [<th key={`${g.ageGroupId}-q`}>Số lượng</th>, <th key={`${g.ageGroupId}-m`}>Tiền</th>])}
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => (
            <tr key={line.foodId}>
              <td className="c">{i + 1}</td>
              <td>{line.name}</td>
              <td className="c">{line.unit}</td>
              <td className="c">{num(line.unitPrice)}</td>
              <td className="c">{line.source === 'STOCK' ? qty(line.quantity) : ''}</td>
              <td className="c">{line.source === 'STOCK' ? '' : qty(line.quantity)}</td>
              <td className="c">{num(line.amount)}</td>
              {line.groups.flatMap((g) => [
                <td key={`${g.ageGroupId}-q`} className="c">
                  {qty(g.quantity)}
                </td>,
                <td key={`${g.ageGroupId}-m`} className="c">
                  {g.quantity ? num(g.amount) : ''}
                </td>,
              ])}
            </tr>
          ))}
          <tr className="ps-total">
            <td colSpan={6}>Tổng chi</td>
            <td className="c">{num(totals.cost)}</td>
            {totals.groups.flatMap((g) => [
              <td key={`${g.ageGroupId}-q`} />,
              <td key={`${g.ageGroupId}-m`} className="c">
                {num(g.cost)}
              </td>,
            ])}
          </tr>
        </tbody>
      </table>
      <p>
        Tổng thu: {num(totals.revenue)} đ · Chi mua chợ: {num(totals.marketCost)} đ · Chi xuất kho: {num(totals.stockCost)} đ · Tổng chi:{' '}
        {num(totals.cost)} đ
        {totals.balance != null && (
          <b>
            {' '}
            · {totals.balance >= 0 ? 'Còn thừa' : 'Còn thiếu'}: {num(Math.abs(totals.balance))} đ
          </b>
        )}
      </p>
      {data.menu.length > 0 && (
        <table className="ps-table">
          <thead>
            <tr>
              <th>Bữa</th>
              {groups.map((g) => (
                <th key={g.ageGroupId}>{g.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.menu.map((meal) => (
              <tr key={meal.code}>
                <td>{meal.name}</td>
                {groups.map((g) => (
                  <td key={g.ageGroupId}>
                    <DishLines dishes={groupCell(meal, g.ageGroupId)?.dishes} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <table className="ps-table ps-sign kb-print-sign">
        <tbody>
          <tr>
            {['Người đi chợ', 'Người giám sát', 'Người kiểm tra'].map((t) => (
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
