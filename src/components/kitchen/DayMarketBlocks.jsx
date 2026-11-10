import { fmtQty } from '@/components/kitchen/KitchenFilters';
import { formatMoney } from '@/utils/format';

/* Khối của màn Đi chợ theo ngày. Mọi số do service tính; ở đây chỉ hiển thị. */

const SOURCE_STOCK = 'STOCK';
const dash = <span className="muted">—</span>;
const qty = (n) => (n ? fmtQty(n) : dash);
const money = (n) => (n == null ? dash : formatMoney(n));
export const groupCell = (row, ageGroupId) => row.groups.find((g) => g.ageGroupId === ageGroupId);

/** Thực phẩm của ngày: đơn giá, lượng xuất kho hoặc mua chợ, thành tiền, rồi số lượng và tiền từng nhóm tuổi. */
export function DayMarketTable({ data }) {
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact">
        <thead>
          <tr>
            <th rowSpan={2} className="num">
              STT
            </th>
            <th rowSpan={2} className="min-w-220">
              Thực phẩm
            </th>
            <th rowSpan={2} className="center">
              Đơn vị
            </th>
            <th rowSpan={2} className="num">
              Đơn giá
            </th>
            <th colSpan={2} className="center">
              Số lượng
            </th>
            <th rowSpan={2} className="num">
              Thành tiền
            </th>
            {data.groups.map((g) => (
              <th key={g.ageGroupId} colSpan={2} className="center">
                {g.name}
              </th>
            ))}
          </tr>
          <tr>
            <th className="num">Xuất kho</th>
            <th className="num">Mua chợ</th>
            {data.groups.flatMap((g) => [
              <th key={`${g.ageGroupId}-q`} className="num">
                Số lượng
              </th>,
              <th key={`${g.ageGroupId}-m`} className="num">
                Tiền
              </th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => (
            <tr key={line.foodId}>
              <td className="num">{i + 1}</td>
              <td>{line.name}</td>
              <td className="center">{line.unit}</td>
              <td className="num nowrap">{money(line.unitPrice)}</td>
              <td className="num">{line.source === SOURCE_STOCK ? qty(line.quantity) : dash}</td>
              <td className="num">{line.source === SOURCE_STOCK ? dash : qty(line.quantity)}</td>
              <td className="num nowrap fw-600">{money(line.amount)}</td>
              {line.groups.flatMap((g) => [
                <td key={`${g.ageGroupId}-q`} className="num">
                  {qty(g.quantity)}
                </td>,
                <td key={`${g.ageGroupId}-m`} className="num nowrap">
                  {g.quantity ? money(g.amount) : dash}
                </td>,
              ])}
            </tr>
          ))}
          <tr className="kb-fc__total">
            <td colSpan={6}>Tổng chi</td>
            <td className="num nowrap">{formatMoney(data.totals.cost)}</td>
            {data.totals.groups.flatMap((g) => [
              <td key={`${g.ageGroupId}-q`} />,
              <td key={`${g.ageGroupId}-m`} className="num nowrap">
                {formatMoney(g.cost)}
              </td>,
            ])}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Thu theo số suất × giá một suất từng nhóm, chi mua chợ và xuất kho, phần còn thừa hoặc thiếu trong ngày. */
export function DayMarketMoney({ data }) {
  const { totals } = data;
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact">
        <thead>
          <tr>
            <th>Khoản</th>
            <th className="num">Số suất</th>
            <th className="num">Giá một suất</th>
            <th className="num">Số tiền</th>
          </tr>
        </thead>
        <tbody>
          {data.groups.map((g) => (
            <tr key={g.ageGroupId}>
              <td>Thu · {g.name}</td>
              <td className="num">{g.servings}</td>
              <td className="num nowrap">{money(g.price)}</td>
              <td className="num nowrap">{money(g.revenue)}</td>
            </tr>
          ))}
          <tr className="kb-fc__total">
            <td>Tổng thu</td>
            <td className="num">{totals.servings}</td>
            <td />
            <td className="num nowrap">{formatMoney(totals.revenue)}</td>
          </tr>
          <tr>
            <td colSpan={3}>Chi mua chợ</td>
            <td className="num nowrap">{formatMoney(totals.marketCost)}</td>
          </tr>
          <tr>
            <td colSpan={3}>Chi xuất kho</td>
            <td className="num nowrap">{formatMoney(totals.stockCost)}</td>
          </tr>
          <tr className="kb-fc__total">
            <td colSpan={3}>Tổng chi</td>
            <td className="num nowrap">{formatMoney(totals.cost)}</td>
          </tr>
          <tr className="kb-fc__total">
            <td colSpan={3}>{totals.balance >= 0 ? 'Còn thừa' : 'Còn thiếu'}</td>
            <td className={`num nowrap ${totals.balance < 0 ? 'kb-short' : ''}`}>{formatMoney(Math.abs(totals.balance))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Các món của một bữa, mỗi món một dòng trong ô (dùng cho cả màn và bản in). */
export function DishLines({ dishes, empty = null }) {
  if (!dishes?.length) return empty;
  return dishes.map((name, i) => <div key={`${i}-${name}`}>{name}</div>);
}

/** Thực đơn của ngày: mỗi bữa một dòng, mỗi nhóm tuổi một cột. */
export function DayMarketMenu({ data }) {
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact">
        <thead>
          <tr>
            <th>Bữa</th>
            {data.groups.map((g) => (
              <th key={g.ageGroupId}>{g.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.menu.map((meal) => (
            <tr key={meal.code}>
              <td className="nowrap">{meal.name}</td>
              {data.groups.map((g) => (
                <td key={g.ageGroupId}>
                  <DishLines dishes={groupCell(meal, g.ageGroupId)?.dishes} empty={dash} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
