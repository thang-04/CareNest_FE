import { StatusBadge } from '@/components/ui/StatusBadge';
import { energyShares } from '@/utils/menu-planning/menuCalculations';
import { coverageTone } from '@/utils/menu-planning/microGroups';
import { NUTRIENT_LABELS, NUTRIENT_UNITS } from '@/models/menu-planning/menuPlanningConstants';

const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : null);

const GROUPS = [
  {
    key: 'energy',
    label: 'Năng lượng và chất sinh năng lượng',
    items: ['kcal', 'protein', 'lipid', 'glucid'],
    labels: NUTRIENT_LABELS,
    units: NUTRIENT_UNITS,
  },
];

/**
 * Thành phần dinh dưỡng sinh năng lượng của thực phẩm trong 100 g/ml ăn được.
 * values = food.nutrition; ô trống = chưa có số liệu.
 */
export function NutrientTable({ values, caption }) {
  const v = values || {};
  const shares = energyShares({ protein: v.protein || 0, lipid: v.lipid || 0, glucid: v.glucid || 0 });
  return (
    <div>
      {/* Chỉ hiển thị nhóm năng lượng trên chi tiết thực phẩm. */}
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
                  <th scope="col" className="center">
                    Số liệu
                  </th>
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
                      <td className="center">
                        {value == null ? <StatusBadge tone="gray" label="Chưa có" /> : <StatusBadge tone="green" label="Có" />}
                      </td>
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
