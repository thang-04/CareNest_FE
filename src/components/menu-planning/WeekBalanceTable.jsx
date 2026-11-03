import { StatusBadge } from '@/components/ui/StatusBadge';
import { isNormConfigured, priceOn } from '@/utils/menu-planning/menuCalculations';
import { daySummary, fmtNum as g } from '@/utils/menu-planning/daySummary';
import { mealsOf } from '@/utils/menu-planning/nutritionSetup';
import { WEEKDAY_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const tone = (status) => (status === 'LOW' ? 'td-low' : status === 'HIGH' ? 'td-high' : '');
const range = (r) => (Array.isArray(r) && r[0] !== '' && r[0] != null ? `${r[0]}–${r[1]}` : '—');
// Đạm, béo: phần động vật / thực vật (g), tỷ lệ động vật (%), tỷ lệ năng lượng (%)
const SPLIT = [
  ['protein', 'Đạm', 'td-col-p', 'animalProtein', 'plantProtein', 'animalProteinPct'],
  ['lipid', 'Béo', 'td-col-l', 'animalLipid', 'plantLipid', 'animalLipidPct'],
];

/**
 * Tab "Cân đối dinh dưỡng" dưới bảng tuần: mỗi dòng một ngày (6 chỉ số g/kcal, tỷ lệ cơ cấu %, % đạt năng lượng),
 * dòng cuối là định mức; ô thấp/cao được tô màu. Dùng chung daySummary với thẻ ngày và chi tiết ngày.
 */
export function WeekBalanceTable({ wm, catalog }) {
  const raw = catalog.norms?.[wm.ageGroupId] || {};
  const norm = isNormConfigured(raw) ? raw : null;
  const basis = (catalog.nutritionSetups || []).find((s) => s.basis)?.basis;
  const price = priceOn(catalog.mealPrices, wm.ageGroupId, wm.weekStart)?.price ?? null;
  const scope = mealsOf(catalog.nutritionSetups, wm.ageGroupId)
    .map((m) => m.name)
    .join(', ');
  return (
    <>
      <div className="row td-tab-note">
        <span className="text-sm muted">
          {norm
            ? `Tính cho 1 trẻ / ngày (${scope}), so với chuẩn tạm (nhập tay) ở Thiết lập${basis ? ` · nguồn: ${basis}` : ''}`
            : 'Nhóm tuổi chưa nhập chuẩn tạm ở Thiết lập: chưa đủ dữ liệu đánh giá dinh dưỡng'}
        </span>
        <span className="row td-legend text-sm">
          <span className="td-low">Thấp hơn định mức</span>
          <span className="td-high">Cao hơn định mức</span>
        </span>
      </div>
      <div className="table-wrap td-tab-table">
        <table className="table table--grid td-balance">
          <thead>
            <tr>
              <th rowSpan={2}>Ngày</th>
              {SPLIT.map(([k, label, cls]) => (
                <th key={k} colSpan={4} className={`center ${cls}`}>
                  {label}
                </th>
              ))}
              <th colSpan={2} className="center td-col-g">
                Tinh bột
              </th>
              <th colSpan={2} className="center">
                Năng lượng
              </th>
              <th rowSpan={2} className="num">
                Tiền ăn
              </th>
              <th rowSpan={2}>Đánh giá</th>
            </tr>
            <tr>
              {SPLIT.flatMap(([k, , cls]) => [
                <th key={`${k}-a`} className={`num ${cls}`}>
                  ĐV (g)
                </th>,
                <th key={`${k}-v`} className={`num ${cls}`}>
                  TV (g)
                </th>,
                <th key={`${k}-s`} className={`num ${cls}`} title="Phần động vật trong tổng">
                  % ĐV
                </th>,
                <th key={`${k}-p`} className={`num ${cls}`} title="Tỷ lệ năng lượng">
                  % NL
                </th>,
              ])}
              <th className="num td-col-g">g</th>
              <th className="num td-col-g" title="Tỷ lệ năng lượng">
                % NL
              </th>
              <th className="num">kcal</th>
              <th className="num" title="Thực tế / giữa khoảng định mức">
                % đạt
              </th>
            </tr>
          </thead>
          <tbody>
            {wm.days.map((d, i) => {
              const sum = daySummary(d, wm, catalog);
              if (!sum)
                return (
                  <tr key={d.date}>
                    <td className="fw-600">{WEEKDAY_LABELS[i]}</td>
                    <td colSpan={14} className="muted text-sm">
                      {d.holiday ? `Nghỉ: ${d.note}` : 'Chưa có thực đơn'}
                    </td>
                  </tr>
                );
              const { nutrients: rows, totals: t, check: st } = sum;
              return (
                <tr key={d.date}>
                  <td className="fw-600">
                    {WEEKDAY_LABELS[i]} <span className="muted">{`${d.date.slice(8, 10)}/${d.date.slice(5, 7)}`}</span>
                  </td>
                  {SPLIT.flatMap(([k, , , animal, plant, share]) => [
                    <td key={`${k}-a`} className="num">
                      {g(t[animal])}
                    </td>,
                    <td key={`${k}-v`} className="num">
                      {g(t[plant])}
                    </td>,
                    <td key={`${k}-s`} className={`num ${tone(rows[share].status)}`}>
                      {g(rows[share].value)}
                    </td>,
                    <td key={`${k}-p`} className={`num ${tone(rows[k].status)}`}>
                      {g(rows[k].percent)}
                    </td>,
                  ])}
                  <td className="num">{g(rows.glucid.value)}</td>
                  <td className={`num ${tone(rows.glucid.status)}`}>{g(rows.glucid.percent)}</td>
                  <td className={`num ${tone(rows.kcal.status)}`}>{g(rows.kcal.value)}</td>
                  <td className="num">{g(rows.kcal.attainment)}</td>
                  <td className={`money nowrap ${sum.overPrice ? 'td-high' : ''}`}>{formatMoney(sum.cost)}</td>
                  <td className="center">
                    <StatusBadge tone={st.tone} label={st.label} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Chuẩn tạm 1 ngày</td>
              {SPLIT.flatMap(([k, , , , , share]) => [
                <td key={`${k}-a`} />,
                <td key={`${k}-v`} />,
                <td key={`${k}-s`} className="num nowrap">
                  {range(raw[share])}
                </td>,
                <td key={`${k}-p`} className="num nowrap">
                  {norm ? range(norm[k]) : '—'}
                </td>,
              ])}
              <td />
              <td className="num nowrap">{norm ? range(norm.glucid) : '—'}</td>
              <td className="num nowrap">{norm ? range(norm.kcal) : '—'}</td>
              <td className="num">{norm ? '100' : '—'}</td>
              <td className="money nowrap">{price != null ? `≤ ${formatMoney(price)}` : '—'}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
}
