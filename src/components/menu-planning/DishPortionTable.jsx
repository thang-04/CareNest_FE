import { compareToNorm, dishTotals } from '@/utils/menu-planning/menuCalculations';
import { ageAbbr } from '@/utils/menu-planning/nutritionSetup';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { microGroupOf } from '@/utils/menu-planning/microGroups';
import { MICRONUTRIENT_GROUPS, MICRONUTRIENTS, MICRONUTRIENT_UNITS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const g1 = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—');
const g2 = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '—');
const PLG = ['protein', 'lipid', 'glucid'];
const TONE = { OK: 'td-tone--ok', LOW: 'td-tone--off', HIGH: 'td-tone--off' };
// Chữ ngắn dưới con số để không chỉ dựa vào màu
const NOTE = { OK: 'Đạt', LOW: 'Thấp', HIGH: 'Cao' };
// Tiêu đề cột vi chất ngắn (nhóm đã ghi ở hàng trên): Canxi, A, B1…
const MICRO_SHORT = {
  calcium: 'Canxi',
  phosphorus: 'Phospho',
  iron: 'Sắt',
  vitaminA: 'A',
  vitaminB1: 'B1',
  vitaminB2: 'B2',
  vitaminPp: 'PP',
  vitaminC: 'C',
};

/**
 * Dinh dưỡng và chi phí một suất của món theo từng nhóm tuổi (mỗi nhóm một hàng, một chỉ số một cột).
 * view 'energy': 6 chỉ số + tỷ lệ năng lượng P, L, G; có `norms` thì tô màu P, L, G so chuẩn nhóm tuổi (chỉ tham khảo —
 * chuẩn tính cho cả ngày, user chốt 03/11/2026). view 'micro': khoáng chất, vitamin (BE NUT-26), chỉ số liệu, không đánh giá.
 */
export function DishPortionTable({ dish, foodById, groups, norms = null, view = 'energy' }) {
  const hasIngredients = (dish?.ingredients || []).length > 0;
  const micro = view === 'micro';
  const cols = micro ? MICRONUTRIENTS.length : 10;
  return (
    <>
      <div className="table-wrap">
        <table className="table table--grid table--compact td-portion-table">
          <thead>
            {micro ? (
              <>
                <tr>
                  <th rowSpan={2} className="td-sticky-first">
                    Nhóm tuổi
                  </th>
                  {MICRONUTRIENT_GROUPS.map((g) => (
                    <th key={g.key} colSpan={g.items.length} className={`center td-micro-th td-micro-th--${g.key}`}>
                      {g.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {MICRONUTRIENTS.map((k) => (
                    <th key={k} className={`num td-micro-th td-micro-th--${microGroupOf(k)}`}>
                      {MICRO_SHORT[k]} ({MICRONUTRIENT_UNITS[k]})
                    </th>
                  ))}
                </tr>
              </>
            ) : (
              <>
                <tr>
                  <th rowSpan={2} className="td-sticky-first">
                    Nhóm tuổi
                  </th>
                  <th colSpan={2} className="center td-col-p">
                    Đạm (g)
                  </th>
                  <th colSpan={2} className="center td-col-l">
                    Béo (g)
                  </th>
                  <th rowSpan={2} className="num td-col-g">
                    Tinh bột (g)
                  </th>
                  <th rowSpan={2} className="num">
                    Năng lượng (kcal)
                  </th>
                  <th colSpan={3} className="center">
                    Tỷ lệ năng lượng (%)
                  </th>
                  <th rowSpan={2} className="num">
                    Chi phí 1 suất
                  </th>
                </tr>
                <tr>
                  <th className="num td-col-p">Động vật</th>
                  <th className="num td-col-p">Thực vật</th>
                  <th className="num td-col-l">Động vật</th>
                  <th className="num td-col-l">Thực vật</th>
                  <th className="num td-col-p">Đạm (P)</th>
                  <th className="num td-col-l">Béo (L)</th>
                  <th className="num td-col-g">Tinh bột (G)</th>
                </tr>
              </>
            )}
          </thead>
          <tbody>
            {groups.map((a) => {
              const r = dishTotals(dish, foodById, 1, a.id);
              if (!hasIngredients || r.noQuantity)
                return (
                  <tr key={a.id}>
                    <td className="fw-600 td-sticky-first">{ageAbbr(a.id)}</td>
                    <td colSpan={cols} className="muted">
                      Chưa có định lượng cho nhóm này
                    </td>
                  </tr>
                );
              const t = r.totals;
              if (micro)
                return (
                  <tr key={a.id}>
                    <td className="fw-600 td-sticky-first">{ageAbbr(a.id)}</td>
                    {MICRONUTRIENTS.map((k) => (
                      <td key={k} className="num">
                        {t[k] == null ? <StatusBadge tone="orange" label="Chưa đủ" /> : g2(t[k])}
                      </td>
                    ))}
                  </tr>
                );
              const rows = compareToNorm(t, a.id, r.missing.length > 0, norms || {});
              const byKey = Object.fromEntries(rows.map((x) => [x.key, x]));
              return (
                <tr key={a.id}>
                  <td className="td-sticky-first">
                    <span className="td-tag td-tag--blue">{ageAbbr(a.id)}</span>
                  </td>
                  <td className="num">{g1(t.animalProtein)}</td>
                  <td className="num">{g1(t.plantProtein)}</td>
                  <td className="num">{g1(t.animalLipid)}</td>
                  <td className="num">{g1(t.plantLipid)}</td>
                  <td className="num">{g1(t.glucid)}</td>
                  <td className="num">
                    <span className="td-tag td-tag--orange">{g1(t.kcal)}</span>
                  </td>
                  {PLG.map((k) => {
                    const row = byKey[k];
                    return (
                      <td
                        key={k}
                        className={`num ${norms ? TONE[row.status] || '' : ''}`}
                        title={norms && row.min != null ? `Chuẩn ${row.min}–${row.max}%` : undefined}
                      >
                        {g1(row.percent)}
                        {norms && NOTE[row.status] && <small className="td-tone__note">{NOTE[row.status]}</small>}
                      </td>
                    );
                  })}
                  <td className="num money nowrap">
                    <span className="td-tag td-tag--green">{formatMoney(r.cost)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {norms && !micro && (
        <p className="text-xs muted td-card-note td-flat">
          Tham khảo: tỷ lệ năng lượng của riêng món so với chuẩn P : L : G cả ngày của nhóm tuổi (ô xanh: đạt, ô cam: thấp hoặc cao; rê
          chuột lên ô để xem chuẩn). Nhóm chưa đặt chuẩn thì không tô màu. Đánh giá chính thức ở thực đơn ngày.
        </p>
      )}
    </>
  );
}
