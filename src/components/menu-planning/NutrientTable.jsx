import { energyShares } from '@/utils/menu-planning/menuCalculations';
import {
  MICRONUTRIENT_GROUPS,
  MICRONUTRIENT_LABELS,
  MICRONUTRIENT_UNITS,
  NUTRIENT_LABELS,
  NUTRIENT_UNITS,
} from '@/models/menu-planning/menuPlanningConstants';

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : null);

const GROUPS = [
  {
    key: 'energy',
    label: 'Năng lượng và chất sinh năng lượng',
    items: ['kcal', 'protein', 'lipid', 'glucid'],
    labels: NUTRIENT_LABELS,
    units: NUTRIENT_UNITS,
  },
  ...MICRONUTRIENT_GROUPS.map((g) => ({ ...g, labels: MICRONUTRIENT_LABELS, units: MICRONUTRIENT_UNITS })),
];

/**
 * Thành phần dinh dưỡng của thực phẩm trong 100 g/ml ăn được: mỗi chất một dòng, chia nhóm (năng lượng, khoáng chất, vitamin).
 * values = food.nutrition; ô trống = chưa có số liệu (BE NUT-26 không bắt buộc vi chất).
 */
export function NutrientTable({ values, caption }) {
  const v = values || {};
  const shares = energyShares({ protein: v.protein || 0, lipid: v.lipid || 0, glucid: v.glucid || 0 });
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact td-nutrient-table">
        {caption && <caption className="td-nutrient-table__caption">{caption}</caption>}
        <thead>
          <tr>
            <th scope="col">Chất</th>
            <th scope="col" className="num">
              Hàm lượng
            </th>
            <th scope="col">Đơn vị</th>
          </tr>
        </thead>
        {GROUPS.map((g) => (
          <tbody key={g.key}>
            <tr className="td-nutrient-table__group">
              <th scope="colgroup" colSpan={3}>
                {g.label}
              </th>
            </tr>
            {g.items.map((k) => {
              const value = fmt(v[k]);
              return (
                <tr key={k}>
                  <th scope="row">{g.labels[k]}</th>
                  <td className="num fw-600">{value ?? <span className="muted">Chưa có</span>}</td>
                  <td className="muted">{g.units[k]}</td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
      {typeof v.kcal === 'number' && (
        <p className="text-xs muted td-flat mt-8">Tỷ lệ năng lượng đạm : béo : tinh bột = {shares.join(' : ')} (%)</p>
      )}
    </div>
  );
}
