import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/States';
import { MEAL_SESSION_LABELS, SESSION_ORDER, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

/*
 * Bảng thống kê một ngày thực đơn cho N trẻ (BE `POST /nutrition/menu-statistics`): thực phẩm × N trẻ, bảng dinh dưỡng
 * so định mức gam/P:L:G, % năng lượng từng bữa. Mọi số do BE tính; màn chỉ đổi đơn vị hiển thị (g → kg, ml → lít).
 */
const num = (v, digits = 1) => (v == null || v === '' ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: digits }));
const BIG_UNITS = { g: 'kg', ml: 'lít' };
const big = (v, unit) => (BIG_UNITS[unit] ? `${num(Number(v) / 1000, 2)} ${BIG_UNITS[unit]}` : `${num(v, 2)} ${unit || ''}`);
const range = (row, suffix = '') => (row?.min == null ? 'Chưa đặt' : `${num(row.min)}–${num(row.max)}${suffix}`);
const TONES = { OK: 'green', LOW: 'orange', HIGH: 'red', INCOMPLETE: 'gray', NA: 'gray' };
const STATUS_LABELS = { OK: 'Đạt', LOW: 'Thiếu', HIGH: 'Vượt', INCOMPLETE: 'Thiếu số liệu', NA: 'Chưa đặt' };
const cellTone = (row) => (row?.status === 'LOW' || row?.status === 'HIGH' ? 'td-stat--off' : row?.status === 'OK' ? 'td-stat--ok' : '');

/** Món theo bữa, xếp sáng → trưa → chiều. */
export function StatisticsDishes({ dishes }) {
  const sessions = SESSION_ORDER.filter((s) => dishes.some((d) => d.session === s));
  if (!dishes.length) return <p className="muted text-sm">Ngày này chưa có món cho nhóm tuổi.</p>;
  return (
    <div className="td-stat-dishes">
      {sessions.map((s) => (
        <div key={s}>
          <h3 className="td-stat-dishes__title">{MEAL_SESSION_LABELS[s] || s}</h3>
          <ol>
            {dishes
              .filter((d) => d.session === s)
              .map((d) => (
                <li key={d.dishId}>{d.dishName}</li>
              ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/** Bảng thực phẩm × N trẻ. */
export function StatisticsIngredients({ stats }) {
  const n = stats.children;
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact td-stat-table">
        <thead>
          <tr>
            <th className="num">STT</th>
            <th>Tên thực phẩm</th>
            <th className="num">Lượng ăn 1 trẻ</th>
            <th className="num">Lượng ăn {n} trẻ</th>
            <th className="num">Thải bỏ (%)</th>
            <th className="num">Lượng mua {n} trẻ</th>
            <th className="num">Mua theo ĐVT</th>
            <th>ĐVT</th>
            <th className="money">Đơn giá</th>
            <th className="money">Tiền ăn {n} trẻ</th>
          </tr>
        </thead>
        <tbody>
          {!stats.ingredients.length && (
            <tr>
              <td colSpan={10}>
                <EmptyState
                  title={`Các món chưa có định lượng cho ${stats.ageGroupName || 'nhóm tuổi này'}`}
                  description="Nhập định lượng ở màn Món ăn để có số liệu."
                />
              </td>
            </tr>
          )}
          {stats.ingredients.map((r, i) => (
            <tr key={r.foodId}>
              <td className="num muted">{i + 1}</td>
              <td>{r.foodName}</td>
              <td className="num nowrap">
                {num(r.gramsPerChild, 2)} {r.unit}
              </td>
              <td className="num nowrap">{big(r.eatenTotal, r.unit)}</td>
              <td className="num">{num(r.wastePct)}</td>
              <td className="num nowrap">{big(r.purchaseTotal, r.unit)}</td>
              <td className="num">{num(r.purchaseQty, 3)}</td>
              <td className="nowrap">{r.purchaseUnit}</td>
              <td className="money nowrap">{r.unitPrice == null ? '—' : formatMoney(r.unitPrice)}</td>
              <td className="money nowrap fw-600">{formatMoney(r.cost)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td colSpan={8} className="fw-600">
              Tổng tiền ăn {n} trẻ
            </td>
            <td className="money nowrap fw-600">{formatMoney(stats.totalCost)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const GRAM_KEYS = ['animalProteinG', 'plantProteinG', 'animalLipidG', 'plantLipidG', 'glucidG'];

/** Bảng dinh dưỡng: tổng, định mức gam/ngày, tỷ lệ đạt, ĐV–TV, cơ cấu P:L:G áp dụng và thực tế. */
export function StatisticsNutrition({ stats }) {
  const ev = stats.evaluation || {};
  const t = ev.totals || {};
  const row = Object.fromEntries((ev.rows || []).map((r) => [r.key, r]));
  const values = [t.animalProtein, t.plantProtein, t.animalLipid, t.plantLipid, t.glucid];
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact td-stat-table">
        <thead>
          <tr>
            <th rowSpan={2}>Một trẻ / ngày</th>
            <th colSpan={2} className="center">
              Đạm (g)
            </th>
            <th colSpan={2} className="center">
              Béo (g)
            </th>
            <th rowSpan={2} className="num">
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
            <th className="num">Động vật</th>
            <th className="num">Thực vật</th>
            <th className="num">Động vật</th>
            <th className="num">Thực vật</th>
          </tr>
        </thead>
        <tbody>
          <tr className="fw-600">
            <td>Tổng cộng</td>
            {values.map((v, i) => (
              <td key={i} className="num">
                {num(v)}
              </td>
            ))}
            <td className="num">{num(t.kcal)}</td>
            <td className="money nowrap">{formatMoney(stats.costPerChild)}</td>
          </tr>
          <tr>
            <td>Định mức một ngày</td>
            {GRAM_KEYS.map((k) => (
              <td key={k} className="num nowrap">
                {range(row[k])}
              </td>
            ))}
            <td className="num nowrap">{range(row.kcal)}</td>
            <td className="money nowrap">{stats.mealPrice == null ? 'Chưa đặt' : formatMoney(stats.mealPrice)}</td>
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
              {stats.mealPrice == null ? '—' : `Chênh ${formatMoney(Number(stats.mealPrice) - Number(stats.costPerChild || 0))}`}
            </td>
          </tr>
          <tr>
            <td>Động vật – thực vật (%)</td>
            {GRAM_KEYS.slice(0, 4).map((k) => (
              <td key={k} className="num">
                {num(row[k]?.percent)}
              </td>
            ))}
            <td colSpan={3} />
          </tr>
          <tr>
            <td>Cơ cấu áp dụng P : L : G (%)</td>
            <td colSpan={2} className="center">
              {range(row.protein)}
            </td>
            <td colSpan={2} className="center">
              {range(row.lipid)}
            </td>
            <td className="num nowrap">{range(row.glucid)}</td>
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

/** Đánh giá % năng lượng từng bữa so định mức (NUT-25). */
export function StatisticsSessions({ sessions }) {
  if (!sessions?.length) return <p className="muted text-sm">Chưa có bữa nào để đánh giá.</p>;
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact">
        <thead>
          <tr>
            <th>Bữa ăn</th>
            <th className="num">kcal</th>
            <th className="num">% nhu cầu cả ngày</th>
            <th className="num">Định mức (%)</th>
            <th>Đánh giá</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.session}>
              <td>{MEAL_SESSION_LABELS[s.session] || s.session}</td>
              <td className="num">{num(s.kcal)}</td>
              <td className="num">{num(s.percent)}</td>
              <td className="num nowrap">{range(s)}</td>
              <td>
                <StatusBadge tone={TONES[s.status] || 'gray'} label={STATUS_LABELS[s.status] || s.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
