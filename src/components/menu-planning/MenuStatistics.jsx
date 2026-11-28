import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';

/*
 * Bảng dinh dưỡng một trẻ của một ngày thực đơn (BE `POST /nutrition/menu-statistics`): so định mức gam/P:L:G.
 * Mọi số do BE tính; màn chỉ định dạng số.
 */
const num = (v, digits = 1) => (v == null || v === '' ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: digits }));
const range = (row, suffix = '', digits = 1) =>
  row?.min == null ? 'Chưa đặt' : `${num(row.min, digits)}–${num(row.max, digits)}${suffix}`;
const CELL_TONES = { OK: 'td-stat--ok', LOW: 'td-stat--low', HIGH: 'td-stat--high' };
// Cơ cấu áp dụng: % trường đã cấu hình ở Định mức dinh dưỡng (BE trả `applied` trên dòng đạm, béo, bột đường)
const appliedLabel = (row) => (row?.applied == null ? 'Chưa đặt' : num(row.applied));
const cellTone = (row) => CELL_TONES[row?.status] || '';

const GRAM_KEYS = ['animalProteinG', 'plantProteinG', 'animalLipidG', 'plantLipidG', 'glucidG'];

/** Bảng dinh dưỡng: tổng, định mức gam/ngày (hàm lượng quy đổi, BE NUT-34), tỷ lệ đạt, cơ cấu P:L:G áp dụng và thực tế. */
export function StatisticsNutrition({ stats }) {
  const ev = stats.evaluation || {};
  const t = ev.totals || {};
  const row = Object.fromEntries((ev.rows || []).map((r) => [r.key, r]));
  // Chưa có định lượng món thì tổng là "—" (thiếu dữ liệu), không hiện 0 như số thật; "Chưa đặt" chỉ dành cho thiếu định mức
  const noQuantity = !stats.ingredients?.length;
  const values = [t.animalProtein, t.plantProtein, t.animalLipid, t.plantLipid, t.glucid];
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact td-stat-table">
        <thead>
          <tr>
            <th rowSpan={2}>Một trẻ / ngày</th>
            <th colSpan={2} className="center td-col-p">
              Đạm (g)
            </th>
            <th colSpan={2} className="center td-col-l">
              Béo (g)
            </th>
            <th rowSpan={2} className="num td-col-g">
              Đường (g)
            </th>
            <th rowSpan={2} className="num">
              Calo (kcal)
            </th>
            <th rowSpan={2} className="money">
              Tiền ăn 1 trẻ
            </th>
          </tr>
          <tr>
            <th className="num td-col-p">Động vật</th>
            <th className="num td-col-p">Thực vật</th>
            <th className="num td-col-l">Động vật</th>
            <th className="num td-col-l">Thực vật</th>
          </tr>
        </thead>
        <tbody>
          <tr className="fw-600">
            <td>Tổng cộng</td>
            {values.map((v, i) => (
              <td key={i} className="num">
                {noQuantity ? '—' : num(v)}
              </td>
            ))}
            <td className="num">
              <span className="td-tag td-tag--orange">{noQuantity ? '—' : num(t.kcal)}</span>
            </td>
            <td className="money nowrap">
              <span className="td-tag td-tag--green">{noQuantity ? '—' : formatMoney(stats.costPerChild)}</span>
            </td>
          </tr>
          <tr>
            <td>Định mức một ngày</td>
            {GRAM_KEYS.map((k) => (
              <td key={k} className="num nowrap">
                {range(row[k], '', 2)}
              </td>
            ))}
            <td className="num nowrap">{range(row.kcal)}</td>
            <td className="money nowrap">
              {(stats.foodBudget ?? stats.mealPrice) == null ? 'Chưa đặt' : formatMoney(stats.foodBudget ?? stats.mealPrice)}
            </td>
          </tr>
          <tr>
            <td>Tỷ lệ đạt (%)</td>
            {GRAM_KEYS.map((k) => (
              <td key={k} className={`num ${cellTone(row[k])}`}>
                {row[k]?.attainment == null ? '—' : row[k].attainment}
              </td>
            ))}
            <td className={`num ${cellTone(row.kcal)}`}>{row.kcal?.attainment == null ? '—' : row.kcal.attainment}</td>
            <td className="money nowrap">
              {stats.mealPrice == null || noQuantity
                ? '—'
                : `Chênh ${formatMoney(Number(stats.foodBudget ?? stats.mealPrice) - Number(stats.costPerChild || 0))}`}
            </td>
          </tr>
          <tr>
            <td>Cơ cấu áp dụng P : L : G (%)</td>
            <td colSpan={2} className="center">
              {appliedLabel(row.protein)}
            </td>
            <td colSpan={2} className="center">
              {appliedLabel(row.lipid)}
            </td>
            <td className="num nowrap">{appliedLabel(row.glucid)}</td>
            <td colSpan={2} />
          </tr>
          <tr>
            <td>Tỷ lệ P : L : G thực tế (%)</td>
            <td colSpan={2} className={`center ${cellTone(row.protein)}`}>
              {num(row.protein?.percent)}
            </td>
            <td colSpan={2} className={`center ${cellTone(row.lipid)}`}>
              {num(row.lipid?.percent)}
            </td>
            <td className={`num ${cellTone(row.glucid)}`}>{num(row.glucid?.percent)}</td>
            <td colSpan={2} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
