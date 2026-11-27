import { Info } from '@/components/ui/icons';
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

// Trang tra cứu của Viện Dinh dưỡng; không có đường dẫn riêng cho từng thực phẩm
const FOOD_LOOKUP_URL = 'https://viendinhduong.vn/vi/cong-cu-va-tien-ich/gia-tri-dinh-duong-thuc-pham';

const ROWS = Array.from({ length: Math.max(...GROUPS.map((g) => g.items.length)) }, (_, i) => i);

/**
 * Thành phần dinh dưỡng của thực phẩm trong 100 g/ml ăn được: năng lượng, vi chất chính, vi chất bổ sung.
 * values = food.nutrition; ô trống = chưa có số liệu (BE NUT-26: vi chất không bắt buộc).
 */
export function NutrientTable({ values, originNote, source }) {
  const v = values || {};
  const shares = energyShares({ protein: v.protein || 0, lipid: v.lipid || 0, glucid: v.glucid || 0 });
  return (
    <div>
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          Bảng chỉ gồm <strong>một số chất dinh dưỡng chủ yếu</strong> dùng khi xây dựng thực đơn,{' '}
          <strong>không phải toàn bộ thành phần</strong> của thực phẩm. Xem đầy đủ hơn tại trang{' '}
          <a className="fw-600" href={FOOD_LOOKUP_URL} target="_blank" rel="noopener noreferrer">
            Tra cứu giá trị dinh dưỡng thực phẩm (Viện Dinh dưỡng)
          </a>
          .
        </div>
      </div>
      {/* Một bảng, mỗi nhóm hai cột đặt cạnh nhau và chung hàng, nên nhóm nhiều hay ít chất vẫn cao bằng nhau */}
      <div className="table-wrap">
        <table className="td-nutrient-table">
          <thead>
            <tr>
              {GROUPS.map((g) => (
                <th key={g.key} scope="colgroup" colSpan={2} className={`td-nutrient-th td-nutrient-th--${g.key}`}>
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {GROUPS.flatMap((g) => [
                <th key={`${g.key}-name`} scope="col" className={`td-nutrient-th td-nutrient-th--${g.key}`}>
                  Chất
                </th>,
                <th key={`${g.key}-value`} scope="col" className={`td-nutrient-num td-nutrient-th td-nutrient-th--${g.key}`}>
                  Hàm lượng
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((i) => (
              <tr key={i}>
                {GROUPS.flatMap((g) => {
                  const k = g.items[i];
                  if (!k) return [<td key={g.key} colSpan={2} />];
                  const value = fmt(v[k]);
                  return [
                    <td key={`${g.key}-name`} className="fw-600">
                      {g.labels[k]}
                    </td>,
                    <td key={`${g.key}-value`} className="td-nutrient-num nowrap">
                      {value == null ? (
                        <span className="muted">Chưa có</span>
                      ) : (
                        <>
                          <strong className="td-nutrient-value">{value}</strong> {g.units[k]}
                        </>
                      )}
                    </td>,
                  ];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="td-nutrient-foot">
        <div>
          {typeof v.kcal === 'number' && <div>Tỷ lệ năng lượng đạm : béo : tinh bột = {shares.join(' : ')} (%)</div>}
          {originNote && <div>{originNote}</div>}
        </div>
        {source && <div>Nguồn: {source}</div>}
      </div>
    </div>
  );
}
