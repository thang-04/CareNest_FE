import { AlertTriangle } from '@/components/ui/icons';
import { AGE_GROUPS } from '@/models/School';
import { dishTotals } from '@/utils/menu-planning/menuCalculations';
import { formatMoney, portionFactorOf } from '@/models/menu-planning/menuPlanningConstants';

const g = (v) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/** Nutrition and cost of one portion of a dish for each age group (portion factor applied). */
export function DishPortionTable({ dish, foodById }) {
  const base = dishTotals(dish, foodById);
  const rows = [
    { key: 'std', label: 'Khẩu phần chuẩn', factor: 1 },
    ...AGE_GROUPS.map((a) => ({ key: a.id, label: a.name, factor: portionFactorOf(a.id) })),
  ];
  return (
    <>
      {base.missing.length > 0 && (
        <div className="alert alert--warning mb-12">
          <AlertTriangle size={18} />
          <div>
            Tính toán chưa đầy đủ: thiếu số liệu dinh dưỡng của <b>{base.missing.join(', ')}</b>.
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Khẩu phần</th>
              <th className="right">Hệ số</th>
              <th className="right">Năng lượng</th>
              <th className="right">Đạm (g)</th>
              <th className="right">Béo (g)</th>
              <th className="right">Bột (g)</th>
              <th className="right">Chi phí</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const t = r.factor === 1 ? base : dishTotals(dish, foodById, r.factor);
              return (
                <tr key={r.key}>
                  <td className={r.key === 'std' ? 'fw-600' : ''}>{r.label}</td>
                  <td className="right">{String(r.factor).replace('.', ',')}</td>
                  <td className="right nowrap">{g(t.totals.kcal)} kcal</td>
                  <td className="right">{g(t.totals.protein)}</td>
                  <td className="right">{g(t.totals.lipid)}</td>
                  <td className="right">{g(t.totals.glucid)}</td>
                  <td className="right nowrap">{formatMoney(t.cost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
