import { StatusBadge } from '@/components/ui/StatusBadge';
import { energyShares } from '@/utils/menu-planning/menuCalculations';
import { coverageTone } from '@/utils/menu-planning/microGroups';
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
    <div>
      {/* Mỗi nhóm một bảng, xếp cạnh nhau khi đủ rộng; tiêu đề nhóm có màu riêng (năng lượng · khoáng chất · vitamin) */}
      <div className="td-nutrient-grid">
        {GROUPS.map((g) => (
          <div key={g.key} className={`table-wrap td-nutrient-group td-nutrient-group--${g.key}`}>
            <table className="table table--grid table--compact td-nutrient-table">
              {caption && g.key === 'energy' && <caption className="td-nutrient-table__caption">{caption}</caption>}
              <thead>
                <tr className="td-nutrient-table__group">
                  <th scope="colgroup" colSpan={3}>
                    <span className="td-nutrient-table__group-in">
                      {g.label}
                      <StatusBadge
                        tone={coverageTone(g.items.filter((k) => typeof v[k] === 'number').length, g.items.length)}
                        label={`${g.items.filter((k) => typeof v[k] === 'number').length}/${g.items.length} có số liệu`}
                      />
                    </span>
                  </th>
                </tr>
                <tr>
                  <th scope="col">Chất</th>
                  <th scope="col" className="num">
                    Hàm lượng
                  </th>
                  <th scope="col">Số liệu</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((k) => {
                  const value = fmt(v[k]);
                  return (
                    <tr key={k}>
                      <th scope="row">{g.labels[k]}</th>
                      <td className="num nowrap fw-600">
                        {value == null ? (
                          <span className="muted">—</span>
                        ) : (
                          <>
                            {value} <span className="muted fw-400">{g.units[k]}</span>
                          </>
                        )}
                      </td>
                      <td>{value == null ? <StatusBadge tone="gray" label="Chưa có" /> : <StatusBadge tone="green" label="Có" />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      {typeof v.kcal === 'number' && (
        <p className="text-xs muted td-flat mt-8">Tỷ lệ năng lượng đạm : béo : tinh bột = {shares.join(' : ')} (%)</p>
      )}
    </div>
  );
}
