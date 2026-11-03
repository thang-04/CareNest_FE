import { dishTotals, energyShares } from '@/utils/menu-planning/menuCalculations';
import { ageAbbr } from '@/utils/menu-planning/nutritionSetup';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const g1 = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—');

/** Dinh dưỡng và chi phí một suất của món theo từng nhóm tuổi: mỗi nhóm một hàng, 6 chỉ số tách cột. */
export function DishPortionTable({ dish, foodById, groups }) {
  const hasIngredients = (dish?.ingredients || []).length > 0;
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact td-portion-table">
        <thead>
          <tr>
            <th rowSpan={2}>Nhóm tuổi</th>
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
              Năng lượng (kcal)
            </th>
            <th rowSpan={2} className="num">
              P : L : G (%)
            </th>
            <th rowSpan={2} className="num">
              Chi phí 1 suất
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
          {groups.map((a) => {
            const r = dishTotals(dish, foodById, 1, a.id);
            if (!hasIngredients || r.noQuantity)
              return (
                <tr key={a.id}>
                  <td className="fw-600">{ageAbbr(a.id)}</td>
                  <td colSpan={8} className="muted">
                    Chưa có định lượng cho nhóm này
                  </td>
                </tr>
              );
            const t = r.totals;
            return (
              <tr key={a.id}>
                <td className="fw-600">{ageAbbr(a.id)}</td>
                <td className="num">{g1(t.animalProtein)}</td>
                <td className="num">{g1(t.plantProtein)}</td>
                <td className="num">{g1(t.animalLipid)}</td>
                <td className="num">{g1(t.plantLipid)}</td>
                <td className="num">{g1(t.glucid)}</td>
                <td className="num fw-600">{g1(t.kcal)}</td>
                <td className="num nowrap">{energyShares(t).join(' : ')}</td>
                <td className="num money nowrap">{formatMoney(r.cost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
