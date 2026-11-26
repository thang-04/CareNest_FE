import { dishTotals, energyShares } from '@/utils/menu-planning/menuCalculations';
import { ageAbbr } from '@/utils/menu-planning/nutritionSetup';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const g1 = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—');
const PLG = ['protein', 'lipid', 'glucid'];

/**
 * Dinh dưỡng và chi phí một suất của món theo từng nhóm tuổi (mỗi nhóm một hàng, một chỉ số một cột).
 * 6 chỉ số + tỷ lệ năng lượng P, L, G; không đánh giá đạt/thấp/cao ở cấp món ăn.
 */
export function DishPortionTable({ dish, foodById, groups }) {
  const hasIngredients = (dish?.ingredients || []).length > 0;
  const cols = 10;
  return (
    <>
      <div className="table-wrap td-card-table td-soft">
        <table className="table table--grid table--compact td-portion-table">
          <thead>
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
              const shares = energyShares(t);
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
                  {PLG.map((k, i) => (
                    <td key={k} className="num">
                      {g1(shares[i])}
                    </td>
                  ))}
                  <td className="num money nowrap">
                    <span className="td-tag td-tag--green">{formatMoney(r.cost)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
