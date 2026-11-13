import { useState } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { NormStatusChip } from '@/components/menu-planning/MenuBadges';
import { StatisticsNutrition } from '@/components/menu-planning/MenuStatistics';
import { MEAL_SESSION_LABELS, SESSION_ORDER, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const num = (v) => (v == null ? '—' : Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 2 }));
const money = (v) => (v == null ? '—' : formatMoney(Number(v)));
const range = (r) => (r && (r.min != null || r.max != null) ? `${num(r.min)}–${num(r.max)}` : '—');
// Tô theo trạng thái BE trả cho chỉ số (LOW thấp, HIGH cao); không tự so định mức ở client
const tone = (r) => (r?.status === 'LOW' ? 'td-daynut--low' : r?.status === 'HIGH' ? 'td-daynut--high' : '');
const TABS = [
  ['meal', 'Theo bữa'],
  ['origin', 'Động vật – thực vật'],
];

/**
 * Bảng "Thông tin dinh dưỡng 1 trẻ / ngày" của mẫu ngày: theo bữa (đạm, béo, bột đường g + % năng lượng, kcal, % nhu cầu năng lượng cả ngày (NUT-25), tiền)
 * và theo nguồn gốc. Mọi số lấy từ `POST /nutrition/menu-statistics` (evaluation.sessions, rows, totals) — BE tính.
 */
export function MealNutritionCard({ ageGroups, ageGroupId, onAgeGroup, statsQ, hasItems }) {
  const [tab, setTab] = useState('meal');
  const stats = statsQ.data;
  const ev = stats?.evaluation || {};
  const row = Object.fromEntries((ev.rows || []).map((r) => [r.key, r]));
  const t = ev.totals || {};
  const sessions = SESSION_ORDER.map((s) => (ev.sessions || []).find((x) => x.session === s)).filter(Boolean);

  return (
    <section className="card td-daynut" aria-label="Thông tin dinh dưỡng 1 trẻ một ngày">
      <div className="card__header td-daynut__head">
        <h2 className="card__title">Thông tin dinh dưỡng 1 trẻ / ngày</h2>
        {ev.status && <NormStatusChip status={ev.status} />}
        {ageGroups.length > 1 && (
          <Tabs
            variant="pill"
            items={ageGroups.map((g) => ({ key: g.id, label: g.name }))}
            value={ageGroupId}
            onChange={onAgeGroup}
            ariaLabel="Nhóm tuổi"
          />
        )}
      </div>
      <div className="card__body">
        {!hasItems ? (
          <p className="text-sm muted">Thêm món cho mẫu để xem dinh dưỡng.</p>
        ) : statsQ.error ? (
          <ErrorState error={statsQ.error} onRetry={statsQ.reload} />
        ) : !stats ? (
          <LoadingState />
        ) : (
          <>
            <div className="td-daynut__tabs">
              <Tabs
                variant="pill"
                items={TABS.map(([key, label]) => ({ key, label }))}
                value={tab}
                onChange={setTab}
                ariaLabel="Cách xem"
              />
              <span className="td-daynut__legend text-sm">
                <span>
                  <i className="td-eval__dot td-eval__dot--low" /> Thấp so với chuẩn
                </span>
                <span>
                  <i className="td-eval__dot td-eval__dot--high" /> Cao so với chuẩn
                </span>
              </span>
            </div>
            {tab === 'origin' ? (
              <StatisticsNutrition stats={stats} />
            ) : (
              <div className="table-wrap">
                <table className="table table--grid td-daynut__table">
                  <thead>
                    <tr>
                      <th rowSpan={2}>Bữa ăn</th>
                      <th colSpan={2} className="center">
                        Đạm (protein)
                      </th>
                      <th colSpan={2} className="center">
                        Béo (lipid)
                      </th>
                      <th colSpan={2} className="center">
                        Bột đường (glucid)
                      </th>
                      <th colSpan={2} className="center">
                        Năng lượng
                      </th>
                      <th rowSpan={2} className="money">
                        Tiền ăn / trẻ
                      </th>
                    </tr>
                    <tr>
                      <th className="num">g</th>
                      <th className="num">% kcal</th>
                      <th className="num">g</th>
                      <th className="num">% kcal</th>
                      <th className="num">g</th>
                      <th className="num">% kcal</th>
                      <th className="num">kcal</th>
                      <th className="num">% nhu cầu ngày</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.session}>
                        <td>{MEAL_SESSION_LABELS[s.session] || s.session}</td>
                        <td className="num">{num(s.protein)}</td>
                        <td className="num">{num(s.proteinEnergyPct)}</td>
                        <td className="num">{num(s.lipid)}</td>
                        <td className="num">{num(s.lipidEnergyPct)}</td>
                        <td className="num">{num(s.glucid)}</td>
                        <td className="num">{num(s.glucidEnergyPct)}</td>
                        <td className="num">{num(s.kcal)}</td>
                        <td className={`num ${tone(s)}`}>{num(s.percent)}</td>
                        <td className="money nowrap">{money(s.cost)}</td>
                      </tr>
                    ))}
                    <tr className="td-daynut__total">
                      <td>Cả ngày</td>
                      <td className="num">{num(t.protein)}</td>
                      <td className={`num ${tone(row.protein)}`}>{num(row.protein?.percent)}</td>
                      <td className="num">{num(t.lipid)}</td>
                      <td className={`num ${tone(row.lipid)}`}>{num(row.lipid?.percent)}</td>
                      <td className="num">{num(t.glucid)}</td>
                      <td className={`num ${tone(row.glucid)}`}>{num(row.glucid?.percent)}</td>
                      <td className={`num ${tone(row.kcal)}`}>{num(t.kcal)}</td>
                      <td />
                      <td
                        className={`money nowrap ${stats.mealPrice != null && Number(stats.costPerChild) > Number(stats.mealPrice) ? 'td-daynut--high' : ''}`}
                      >
                        {money(stats.costPerChild)}
                      </td>
                    </tr>
                    <tr className="td-daynut__norm">
                      <td>Định mức 1 ngày</td>
                      <td />
                      <td className="num nowrap">{range(row.protein)}</td>
                      <td />
                      <td className="num nowrap">{range(row.lipid)}</td>
                      <td />
                      <td className="num nowrap">{range(row.glucid)}</td>
                      <td className="num nowrap">{range(row.kcal)}</td>
                      <td />
                      <td className="money nowrap">{stats.mealPrice == null ? 'Chưa đặt' : money(stats.mealPrice)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
