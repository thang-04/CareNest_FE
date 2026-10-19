import { Scale } from '@/components/ui/icons';
import { compareToNorm, mealsTotals, priceOn } from '@/utils/menu-planning/menuCalculations';
import { checkDayMenu } from '@/utils/menu-planning/menuChecks';
import { WEEKDAY_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const g = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—');
const tone = (status) => (status === 'LOW' ? 'td-low' : status === 'HIGH' ? 'td-high' : '');
const NUTS = [
  ['protein', 'Đạm', 'td-col-p'],
  ['lipid', 'Béo', 'td-col-l'],
  ['glucid', 'Bột', 'td-col-g'],
];

/** Bảng "Cân đối dinh dưỡng cả tuần" ở cuối trang: mỗi dòng một ngày, dòng cuối là định mức; ô thấp/cao được tô màu. */
export function WeekBalanceTable({ wm, catalog }) {
  const norm = catalog.norms?.[wm.ageGroupId];
  const price = priceOn(catalog.mealPrices, wm.ageGroupId, wm.weekStart)?.price ?? null;
  return (
    <section className="card">
      <div className="card__header">
        <div>
          <h2 className="card__title">
            <Scale size={18} /> Cân đối dinh dưỡng cả tuần
          </h2>
          <span className="text-sm muted">Tính cho 1 trẻ / ngày, so với định mức ở Thiết lập</span>
        </div>
        <span className="row td-legend text-sm">
          <span className="td-low">Thấp hơn định mức</span>
          <span className="td-high">Cao hơn định mức</span>
        </span>
      </div>
      <div className="table-wrap">
        <table className="table table--grid td-balance">
          <thead>
            <tr>
              <th rowSpan={2}>Ngày</th>
              {NUTS.map(([k, label, cls]) => (
                <th key={k} colSpan={2} className={`center ${cls}`}>
                  {label}
                </th>
              ))}
              <th rowSpan={2} className="right">
                Năng lượng
              </th>
              <th rowSpan={2} className="right">
                Tiền ăn
              </th>
              <th rowSpan={2}>Đánh giá</th>
            </tr>
            <tr>
              {NUTS.flatMap(([k, , cls]) => [
                <th key={`${k}-g`} className={`right ${cls}`}>
                  g
                </th>,
                <th key={`${k}-p`} className={`right ${cls}`}>
                  %
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {wm.days.map((d, i) => {
              if (d.holiday || !d.meals?.some((m) => m.items?.length))
                return (
                  <tr key={d.date}>
                    <td className="fw-600">{WEEKDAY_LABELS[i]}</td>
                    <td colSpan={9} className="muted text-sm">
                      {d.holiday ? `Nghỉ: ${d.note}` : 'Chưa có thực đơn'}
                    </td>
                  </tr>
                );
              const r = mealsTotals(d.meals, catalog.dishById, catalog.foodById, wm.ageGroupId);
              const rows = Object.fromEntries(
                compareToNorm(r.totals, wm.ageGroupId, r.missing.length > 0, catalog.norms).map((x) => [x.key, x]),
              );
              const st = checkDayMenu({ meals: d.meals, ageGroupId: wm.ageGroupId, catalog, date: d.date }).status;
              return (
                <tr key={d.date}>
                  <td className="fw-600">
                    {WEEKDAY_LABELS[i]} <span className="muted">{`${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`}</span>
                  </td>
                  {NUTS.flatMap(([k]) => [
                    <td key={`${k}-g`} className="right">
                      {g(rows[k].value)}
                    </td>,
                    <td key={`${k}-p`} className={`right ${tone(rows[k].status)}`}>
                      {g(rows[k].percent)}
                    </td>,
                  ])}
                  <td className={`right ${tone(rows.kcal.status)}`}>{g(rows.kcal.value)}</td>
                  <td className={`right nowrap ${price != null && r.cost > price ? 'td-high' : ''}`}>{formatMoney(r.cost)}</td>
                  <td>
                    <span className={`chip chip--${st.tone}`}>{st.label}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {norm && (
            <tfoot>
              <tr>
                <td>Định mức 1 ngày</td>
                {NUTS.flatMap(([k]) => [
                  <td key={`${k}-g`} />,
                  <td key={`${k}-p`} className="right nowrap">
                    {norm[k][0]}–{norm[k][1]}
                  </td>,
                ])}
                <td className="right nowrap">
                  {norm.kcal[0]}–{norm.kcal[1]}
                </td>
                <td className="right nowrap">{price != null ? `≤ ${formatMoney(price)}` : '—'}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}
