import { energyShares, structureShares } from '@/utils/menu-planning/menuCalculations';

const fmt = (v) => (Math.round((Number(v) || 0) * 10) / 10).toLocaleString('vi-VN');
const ROWS = [
  ['protein', 'Đạm (Protein)', 'p'],
  ['lipid', 'Béo (Lipid)', 'l'],
  ['glucid', 'Tinh bột (glucid)', 'g'],
];

const SPLIT = {
  protein: ['animalProtein', 'plantProtein', 'animalProteinPct'],
  lipid: ['animalLipid', 'plantLipid', 'animalLipidPct'],
};

/**
 * Dinh dưỡng kiểu MISA: năng lượng nổi bật, đạm / béo / bột mỗi chất một thanh; độ dài thanh = % năng lượng từ chất đó.
 * values: { kcal, protein, lipid, glucid } (+ animalProtein… khi split); split: hiện phần động vật / thực vật và tỷ lệ động vật.
 * missing: true khi chưa đủ số liệu (hiện cảnh báo thay vì số sai).
 */
export function NutrientBars({ values, title, missing = false, split = false }) {
  const shares = energyShares(values || {});
  const structure = split ? structureShares(values) : null;
  return (
    <div className="td-nut">
      {title && <div className="td-nut__title">{title}</div>}
      <div className="td-nut__kcal">
        <span>Năng lượng (kcal)</span>
        <b>{fmt(values?.kcal)} kcal</b>
      </div>
      {ROWS.map(([k, label, tone], i) => (
        <div key={k} className="td-nut__bar">
          <div className="td-nut__row">
            <span className="td-grow">{label}</span>
            <b>{fmt(values?.[k])} g</b>
            <span className="text-sm muted td-nut__pct">{shares[i]}% NL</span>
          </div>
          {split && SPLIT[k] && (
            <div className="text-xs muted">
              Động vật {fmt(values?.[SPLIT[k][0]])} g · Thực vật {fmt(values?.[SPLIT[k][1]])} g · động vật chiếm{' '}
              {structure[SPLIT[k][2]] == null ? '—' : `${fmt(structure[SPLIT[k][2]])}%`}
            </div>
          )}
          <span className="td-nut__track" role="img" aria-label={`${label}: ${shares[i]}% năng lượng`}>
            <span className={`td-nut__fill td-nut__fill--${tone}`} style={{ width: `${shares[i]}%` }} />
          </span>
        </div>
      ))}
      {missing && (
        <p className="td-warn text-sm td-flat">
          Một số thực phẩm chưa có số liệu dinh dưỡng hoặc nguồn gốc; con số có thể thấp hơn thực tế, chưa đánh giá.
        </p>
      )}
    </div>
  );
}
