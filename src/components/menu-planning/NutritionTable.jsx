import { AlertTriangle } from '@/components/ui/icons';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { NormStatusChip } from '@/components/menu-planning/MenuBadges';
import { compareToNorm } from '@/utils/menu-planning/menuCalculations';
import {
  MICRONUTRIENTS,
  MICRONUTRIENT_LABELS,
  MICRONUTRIENT_UNITS,
  SHARE_LABELS,
  formatMoney,
} from '@/models/menu-planning/menuPlanningConstants';
import { mealsOf } from '@/utils/menu-planning/nutritionSetup';

const fmt = (n) => (typeof n === 'number' ? n.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—');
// Vi chất có số nhỏ (vitamin B1 0,05 mg) ⇒ giữ 2 chữ số thập phân
const fmt2 = (n) => (typeof n === 'number' ? n.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : '—');
const pct = (n) => (typeof n === 'number' ? `${fmt(n)}%` : '—');
const range = (r) => (r.min == null ? 'Chưa đặt' : `${r.min}–${r.max}%`);
// Vi chất: số sau trống = chỉ cần đạt tối thiểu
const microRange = (r, unit) =>
  r.min == null ? 'Chưa đặt' : r.max == null ? `≥ ${fmt2(r.min)} ${unit}` : `${fmt2(r.min)}–${fmt2(r.max)} ${unit}`;

const ENERGY_LABELS = { protein: 'Năng lượng từ đạm (P)', lipid: 'Năng lượng từ béo (L)', glucid: 'Năng lượng từ tinh bột (G)' };
const TARGET_LABELS = { kcal: 'Năng lượng', protein: 'Chất đạm', lipid: 'Chất béo', glucid: 'Tinh bột' };

/** Bảng lượng thực tế: 6 chỉ số (đạm, béo chia động vật / thực vật; tinh bột; năng lượng) kèm tổng đạm, tổng béo. */
export function IndicatorAmounts({ totals, title = 'Lượng thực tế' }) {
  const t = totals || {};
  return (
    <div className="table-wrap">
      <table className="table table--grid table--compact">
        <thead>
          <tr>
            <th>{title}</th>
            <th className="num">Động vật</th>
            <th className="num">Thực vật</th>
            <th className="num">Tổng</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Chất đạm (protein)</td>
            <td className="num nowrap">{fmt(t.animalProtein)} g</td>
            <td className="num nowrap">{fmt(t.plantProtein)} g</td>
            <td className="num nowrap fw-600">{fmt(t.protein)} g</td>
          </tr>
          <tr>
            <td>Chất béo (lipid)</td>
            <td className="num nowrap">{fmt(t.animalLipid)} g</td>
            <td className="num nowrap">{fmt(t.plantLipid)} g</td>
            <td className="num nowrap fw-600">{fmt(t.lipid)} g</td>
          </tr>
          <tr>
            <td>Tinh bột (glucid)</td>
            <td className="num muted">—</td>
            <td className="num muted">—</td>
            <td className="num nowrap fw-600">{fmt(t.glucid)} g</td>
          </tr>
          <tr>
            <td>Năng lượng</td>
            <td className="num muted">—</td>
            <td className="num muted">—</td>
            <td className="num nowrap fw-600">{fmt(t.kcal)} kcal</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Dải tiêu đề nhóm trong bảng cân đối (5 cột); tone = màu nền nhóm (info · success · warning · gray). */
function SectionRow({ title, tone }) {
  return (
    <tr className={`td-nut-sec td-nut-sec--${tone}`}>
      <th scope="colgroup" colSpan={5}>
        {title}
      </th>
    </tr>
  );
}

/**
 * Cân đối khẩu phần một ngày (GBR-MENU-02): một bảng thống nhất 5 cột (Chỉ số · Thực tế · Định mức · % đạt · Đánh giá), chia 4
 * nhóm: năng lượng và chất sinh năng lượng, cơ cấu (%), khoáng chất và vitamin, chi phí. Chỉ số liệu, không lời khuyên sức khỏe.
 * result = mealsTotals(...) → { totals, missing, cost }.
 */
export function NutritionTable({ result, ageGroupId, norms, price, setups }) {
  const scope = setups ? mealsOf(setups, ageGroupId).map((m) => m.name) : [];
  const incomplete = (result?.missing || []).length > 0;
  const rows = compareToNorm(result?.totals, ageGroupId, incomplete, norms);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const t = result?.totals || {};
  // Đạm, béo hiện kèm phần chia động vật / thực vật ngay dưới tên chỉ số
  const origin = {
    protein: `Động vật ${fmt(t.animalProtein)} g · thực vật ${fmt(t.plantProtein)} g`,
    lipid: `Động vật ${fmt(t.animalLipid)} g · thực vật ${fmt(t.plantLipid)} g`,
  };
  return (
    <>
      {incomplete && (
        <div className="alert alert--warning mb-12">
          <AlertTriangle size={18} />
          <div>
            Chưa đủ dữ liệu để đánh giá: thiếu số liệu dinh dưỡng hoặc nguồn gốc của <b>{result.missing.join(', ')}</b>. Số liệu dưới đây
            chỉ cộng phần đã có; hãy bổ sung ở danh mục thực phẩm.
          </div>
        </div>
      )}
      <div className="table-wrap">
        <table className="table table--grid table--compact td-nut-table">
          <colgroup>
            <col className="td-nut-table__c1" />
            <col />
            <col />
            <col />
            <col className="td-nut-table__c5" />
          </colgroup>
          <thead>
            <tr>
              <th>Chỉ số (1 trẻ / ngày)</th>
              <th className="num">Thực tế</th>
              <th className="num">Định mức</th>
              <th className="num">% đạt</th>
              <th>Đánh giá</th>
            </tr>
          </thead>
          <tbody>
            <SectionRow title="Năng lượng và chất sinh năng lượng" tone="info" />
            {['kcal', 'protein', 'lipid', 'glucid'].map((k) => {
              const r = byKey[k];
              const unit = k === 'kcal' ? 'kcal' : 'g';
              return (
                <tr key={k}>
                  <td>
                    {TARGET_LABELS[k]}
                    {origin[k] && <div className="text-xs muted">{origin[k]}</div>}
                  </td>
                  <td className="num nowrap fw-600">
                    {fmt(r.value)} {unit}
                  </td>
                  <td className="num nowrap">{r.target == null ? 'Chưa đặt' : `${fmt(r.target)} ${unit}`}</td>
                  <td className="num">{pct(r.attainment)}</td>
                  <td>
                    {k === 'kcal' ? <NormStatusChip status={r.status} /> : <span className="muted text-sm">Theo tỷ lệ năng lượng</span>}
                  </td>
                </tr>
              );
            })}

            <SectionRow title="Cơ cấu năng lượng và nguồn đạm, béo (%)" tone="success" />
            {['animalProteinPct', 'animalLipidPct'].map((k) => (
              <tr key={k}>
                <td>{SHARE_LABELS[k]}</td>
                <td className="num nowrap fw-600">{pct(byKey[k].value)}</td>
                <td className="num nowrap">{range(byKey[k])}</td>
                <td className="num muted">—</td>
                <td>
                  <NormStatusChip status={byKey[k].status} />
                </td>
              </tr>
            ))}
            {['protein', 'lipid', 'glucid'].map((k) => (
              <tr key={k}>
                <td>{ENERGY_LABELS[k]}</td>
                <td className="num nowrap fw-600">{pct(byKey[k].percent)}</td>
                <td className="num nowrap">{range(byKey[k])}</td>
                <td className="num muted">—</td>
                <td>
                  <NormStatusChip status={byKey[k].status} />
                </td>
              </tr>
            ))}

            <SectionRow title="Khoáng chất, vitamin" tone="warning" />
            {MICRONUTRIENTS.map((k) => {
              const r = byKey[k];
              const unit = MICRONUTRIENT_UNITS[k];
              return (
                <tr key={k}>
                  <td>{MICRONUTRIENT_LABELS[k]}</td>
                  <td className="num nowrap fw-600">{r.value == null ? '—' : `${fmt2(r.value)} ${unit}`}</td>
                  <td className="num nowrap">{microRange(r, unit)}</td>
                  <td className="num">{pct(r.attainment)}</td>
                  <td>
                    <NormStatusChip status={r.status} />
                  </td>
                </tr>
              );
            })}

            {result && (
              <>
                <SectionRow title="Chi phí" tone="gray" />
                <tr>
                  <td>Chi phí thực phẩm ước tính</td>
                  <td className="num nowrap fw-600">{formatMoney(result.cost)}</td>
                  <td className="num nowrap">{price ? formatMoney(price) : 'Chưa có giá'}</td>
                  <td className="num">{price ? pct(Math.round((result.cost * 100) / price)) : '—'}</td>
                  <td>
                    {price ? (
                      <StatusBadge
                        tone={result.cost > price ? 'orange' : 'green'}
                        label={result.cost > price ? 'Vượt giá suất ăn' : 'Trong giá suất ăn'}
                      />
                    ) : (
                      <StatusBadge tone="gray" label="Chưa đủ dữ liệu" />
                    )}
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs muted mt-8">
        Định mức do nhà trường cấu hình cho các bữa trường phục vụ của nhóm tuổi{scope.length ? ` (${scope.join(', ')})` : ''}. Mục tiêu =
        giữa khoảng định mức; đạm, béo, tinh bột quy ra gam từ mục tiêu năng lượng và tỷ lệ năng lượng.
      </p>
    </>
  );
}
