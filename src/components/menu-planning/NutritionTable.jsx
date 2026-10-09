import { AlertTriangle } from '@/components/ui/icons';
import { NormStatusChip } from '@/components/menu-planning/MenuBadges';
import { compareToNorm } from '@/utils/menu-planning/menuCalculations';
import { NUTRIENT_LABELS, NUTRIENT_UNITS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—');

/**
 * Day totals against the age-group reference (GBR-MENU-02). Values only, no health wording.
 * result = mealsTotals(...) → { totals, missing, cost }.
 */
export function NutritionTable({ result, ageGroupId, price }) {
  const incomplete = (result?.missing || []).length > 0;
  const rows = compareToNorm(result?.totals, ageGroupId, incomplete);
  return (
    <>
      {incomplete && (
        <div className="alert alert--warning mb-12">
          <AlertTriangle size={18} />
          <div>
            Tính toán chưa đầy đủ: thiếu số liệu dinh dưỡng của <b>{result.missing.join(', ')}</b>. Hãy bổ sung ở danh mục thực phẩm.
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Chất dinh dưỡng</th>
              <th className="right">Giá trị / trẻ / ngày</th>
              <th className="right">% năng lượng</th>
              <th className="right">Định mức tham khảo</th>
              <th>Đánh giá</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{NUTRIENT_LABELS[r.key]}</td>
                <td className="right nowrap">
                  {fmt(r.value)} {NUTRIENT_UNITS[r.key]}
                </td>
                <td className="right">{r.key === 'kcal' ? '—' : r.percent == null ? '—' : `${fmt(r.percent)}%`}</td>
                <td className="right nowrap">{r.min == null ? '—' : r.key === 'kcal' ? `${r.min}–${r.max} kcal` : `${r.min}–${r.max}%`}</td>
                <td>
                  <NormStatusChip status={r.status} />
                </td>
              </tr>
            ))}
            {result && (
              <tr>
                <td>Chi phí thực phẩm ước tính</td>
                <td className="right nowrap">{formatMoney(result.cost)}</td>
                <td />
                <td className="right nowrap">{price ? `Giá suất ăn ${formatMoney(price)}` : 'Chưa có giá suất ăn'}</td>
                <td>
                  {price ? (
                    <span className={`chip chip--${result.cost > price ? 'orange' : 'green'}`}>
                      {result.cost > price ? 'Vượt giá suất ăn' : 'Trong giá suất ăn'}
                    </span>
                  ) : (
                    <span className="chip chip--gray">Chưa đủ dữ liệu</span>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs muted mt-8">
        Định mức là giá trị tham khảo do nhà trường cấu hình cho một ngày ở trường; đạm, béo, bột tính theo tỉ lệ năng lượng.
      </p>
    </>
  );
}
