import { StatusBadge } from '@/components/ui/StatusBadge';
import { isNormConfigured, priceOn } from '@/utils/menu-planning/menuCalculations';
import { daySummary, fmtNum as g } from '@/utils/menu-planning/daySummary';
import { WEEKDAY_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const tone = (status) => (status === 'LOW' ? 'td-low' : status === 'HIGH' ? 'td-high' : '');
const NUTS = [
  ['protein', 'Đạm', 'td-col-p'],
  ['lipid', 'Béo', 'td-col-l'],
  ['glucid', 'Tinh bột', 'td-col-g'],
];

/** Tab "Cân đối dinh dưỡng" dưới bảng tuần: mỗi dòng một ngày, dòng cuối là định mức; ô thấp/cao được tô màu. */
export function WeekBalanceTable({ wm, catalog }) {
  const norm = isNormConfigured(catalog.norms?.[wm.ageGroupId]) ? catalog.norms[wm.ageGroupId] : null;
  const basis = (catalog.nutritionSetups || []).find((s) => s.basis)?.basis;
  const price = priceOn(catalog.mealPrices, wm.ageGroupId, wm.weekStart)?.price ?? null;
  return (
    <>
      <div className="row td-tab-note">
        <span className="text-sm muted">
          {norm
            ? `Tính cho 1 trẻ / ngày, so với chuẩn tạm (nhập tay) ở Thiết lập${basis ? ` · nguồn: ${basis}` : ''}`
            : 'Nhóm tuổi chưa nhập chuẩn tạm ở Thiết lập: chưa đủ dữ liệu đánh giá dinh dưỡng'}
        </span>
        <span className="row td-legend text-sm">
          <span className="td-low">Thấp hơn định mức</span>
          <span className="td-high">Cao hơn định mức</span>
        </span>
      </div>
      <div className="table-wrap td-tab-table">
        <table className="table table--grid td-balance">
          <thead>
            <tr>
              <th rowSpan={2}>Ngày</th>
              {NUTS.map(([k, label, cls]) => (
                <th key={k} colSpan={2} className={`center ${cls}`}>
                  {label}
                </th>
              ))}
              <th rowSpan={2} className="num">
                Năng lượng
              </th>
              <th rowSpan={2} className="num">
                Tiền ăn
              </th>
              <th rowSpan={2}>Đánh giá</th>
            </tr>
            <tr>
              {NUTS.flatMap(([k, , cls]) => [
                <th key={`${k}-g`} className={`num ${cls}`}>
                  g
                </th>,
                <th key={`${k}-p`} className={`num ${cls}`}>
                  %
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {wm.days.map((d, i) => {
              const sum = daySummary(d, wm, catalog);
              if (!sum)
                return (
                  <tr key={d.date}>
                    <td className="fw-600">{WEEKDAY_LABELS[i]}</td>
                    <td colSpan={9} className="muted text-sm">
                      {d.holiday ? `Nghỉ: ${d.note}` : 'Chưa có thực đơn'}
                    </td>
                  </tr>
                );
              const { nutrients: rows, check: st } = sum;
              return (
                <tr key={d.date}>
                  <td className="fw-600">
                    {WEEKDAY_LABELS[i]} <span className="muted">{`${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`}</span>
                  </td>
                  {NUTS.flatMap(([k]) => [
                    <td key={`${k}-g`} className="num">
                      {g(rows[k].value)}
                    </td>,
                    <td key={`${k}-p`} className={`num ${tone(rows[k].status)}`}>
                      {g(rows[k].percent)}
                    </td>,
                  ])}
                  <td className={`num ${tone(rows.kcal.status)}`}>{g(rows.kcal.value)}</td>
                  <td className={`money nowrap ${sum.overPrice ? 'td-high' : ''}`}>{formatMoney(sum.cost)}</td>
                  <td className="center">
                    <StatusBadge tone={st.tone} label={st.label} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          {norm && (
            <tfoot>
              <tr>
                <td>Chuẩn tạm 1 ngày</td>
                {NUTS.flatMap(([k]) => [
                  <td key={`${k}-g`} />,
                  <td key={`${k}-p`} className="num nowrap">
                    {norm[k][0]}–{norm[k][1]}
                  </td>,
                ])}
                <td className="num nowrap">
                  {norm.kcal[0]}–{norm.kcal[1]}
                </td>
                <td className="money nowrap">{price != null ? `≤ ${formatMoney(price)}` : '—'}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  );
}
