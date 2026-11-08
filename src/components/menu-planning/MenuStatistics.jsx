import { EmptyState } from '@/components/ui/States';
import { NormRowBadge } from '@/components/menu-planning/MenuBadges';
import { DISH_TYPE_LABELS, MEAL_SESSION_LABELS, SESSION_ORDER, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import { dishTypeClass } from '@/utils/dishTypeClass';
import { dishNutrition } from '@/utils/menu-planning/menuStatistics';

/*
 * Bảng thống kê một ngày thực đơn cho N trẻ (BE `POST /nutrition/menu-statistics`): thực phẩm × N trẻ, bảng dinh dưỡng
 * so định mức gam/P:L:G, % năng lượng từng bữa. Mọi số do BE tính; màn chỉ đổi đơn vị hiển thị (g → kg, ml → lít).
 */
const num = (v, digits = 1) => (v == null || v === '' ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: digits }));
const BIG_UNITS = { g: 'kg', ml: 'lít' };
const big = (v, unit) => (BIG_UNITS[unit] ? `${num(Number(v) / 1000, 2)} ${BIG_UNITS[unit]}` : `${num(v, 2)} ${unit || ''}`);
const range = (row, suffix = '') => (row?.min == null ? 'Chưa đặt' : `${num(row.min)}–${num(row.max)}${suffix}`);
const CELL_TONES = { OK: 'td-stat--ok', LOW: 'td-stat--low', HIGH: 'td-stat--high' };
const cellTone = (row) => CELL_TONES[row?.status] || '';

/** Bảng món theo bữa (sáng → trưa → chiều); số một suất đọc từ danh mục món theo nhóm tuổi đang xem. */
export function StatisticsDishes({ dishes, catalog, ageGroup }) {
  if (!dishes.length) return <EmptyState title="Ngày này chưa có món" description="Nhóm tuổi này chưa có món trong ngày." />;
  const byId = Object.fromEntries((catalog || []).map((d) => [String(d.id), d]));
  const sessions = SESSION_ORDER.filter((s) => dishes.some((d) => d.session === s));
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact td-stat-table">
        <thead>
          <tr>
            <th>Bữa ăn</th>
            <th>Món ăn</th>
            <th className="center">Loại món</th>
            <th className="num">Năng lượng (kcal)</th>
            <th className="num">Đạm (g)</th>
            <th className="num">Béo (g)</th>
            <th className="num">Bột đường (g)</th>
          </tr>
        </thead>
        <tbody>
          {sessions.flatMap((s) => {
            const rows = dishes.filter((d) => d.session === s);
            return rows.map((d, i) => {
              const n = dishNutrition(byId[String(d.dishId)], ageGroup);
              return (
                <tr key={`${s}-${d.dishId}`}>
                  {i === 0 && (
                    <th scope="rowgroup" rowSpan={rows.length} className="td-stat-table__session">
                      {MEAL_SESSION_LABELS[s] || s}
                    </th>
                  )}
                  <td>{d.dishName}</td>
                  <td className="center">
                    <span className={`td-dish-type ${dishTypeClass(d.dishType)}`}>{DISH_TYPE_LABELS[d.dishType] || 'Món khác'}</span>
                  </td>
                  <td className="num">{num(n?.kcal)}</td>
                  <td className="num">{num(n?.protein)}</td>
                  <td className="num">{num(n?.lipid)}</td>
                  <td className="num">{num(n?.glucid)}</td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Bảng thực phẩm × N trẻ. */
export function StatisticsIngredients({ stats }) {
  const n = stats.children;
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact table--wrap-head td-stat-table">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Tên thực phẩm</th>
            <th className="num">Lượng ăn 1 trẻ</th>
            <th className="num">Lượng ăn {n} trẻ</th>
            <th className="num">Thải bỏ (%)</th>
            <th className="num">Lượng mua {n} trẻ</th>
            <th className="num">Mua theo ĐVT</th>
            <th className="center">ĐVT</th>
            <th className="money">Đơn giá</th>
            <th className="money">Tiền ăn {n} trẻ</th>
          </tr>
        </thead>
        <tbody>
          {!stats.ingredients.length && (
            <tr>
              <td colSpan={10} className="muted">
                Các món chưa có định lượng cho {stats.ageGroupName || 'nhóm tuổi này'}. Nhập định lượng ở màn Món ăn để có số liệu.
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
              <td className="nowrap center">{r.purchaseUnit}</td>
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
                {num(v)}
              </td>
            ))}
            <td className="num">
              <span className="td-tag td-tag--orange">{num(t.kcal)}</span>
            </td>
            <td className="money nowrap">
              <span className="td-tag td-tag--green">{formatMoney(stats.costPerChild)}</span>
            </td>
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
  if (!sessions?.length) return <EmptyState title="Chưa có bữa nào để đánh giá" description="Thêm món cho ngày này rồi xem lại." />;
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact">
        <thead>
          <tr>
            <th>Bữa ăn</th>
            <th className="num">kcal</th>
            <th className="num">% nhu cầu cả ngày</th>
            <th className="num">Định mức (%)</th>
            <th className="center">Đánh giá</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.session}>
              <td>{MEAL_SESSION_LABELS[s.session] || s.session}</td>
              <td className="num">{num(s.kcal)}</td>
              <td className="num">{num(s.percent)}</td>
              <td className="num nowrap">{range(s)}</td>
              <td className="center">
                <NormRowBadge status={s.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
