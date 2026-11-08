import { StatCard } from '@/components/ui/StatCard';
import { NormStatusChip } from '@/components/menu-planning/MenuBadges';
import { dayNormStatus } from '@/components/menu-planning/WeekDaysView';
import { daySummary, fmtNum as g } from '@/utils/menu-planning/daySummary';
import { clickableRowProps } from '@/utils/clickableRow';
import { formatDate } from '@/utils/format';
import { WEEKDAY_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';

const COLS = 10;

/**
 * Cân đối dinh dưỡng cả tuần dạng bảng: mỗi hàng một ngày (năng lượng, đạm, béo, tinh bột, tiền ăn, đánh giá so định mức),
 * bấm hàng để chọn ngày sửa bên dưới. Dải số liệu phía trên đếm số ngày theo đánh giá đã tính, không tự đánh giá lại.
 * `date` + `meals`: ngày đang chọn tính theo món đang chỉnh (chưa lưu) để hàng đổi ngay.
 */
export function DayNutritionTable({ wm, catalog, date, meals, onSelect }) {
  const rows = wm.days.map((day, i) => {
    const sum = daySummary(day.date === date ? { ...day, meals } : day, wm, catalog);
    return { day, i, sum, status: sum ? dayNormStatus(Object.values(sum.nutrients)) : null };
  });
  const count = (fn) => rows.filter((r) => r.status && fn(r.status)).length;
  const ok = count((s) => s === 'OK');
  const off = count((s) => s === 'LOW' || s === 'HIGH');
  const noData = rows.filter(
    (r) => !r.day.holiday && (!r.status || (r.status !== 'OK' && r.status !== 'LOW' && r.status !== 'HIGH')),
  ).length;

  return (
    <>
      <div className="stat-grid">
        <StatCard tone="green" label="Ngày trong định mức" value={ok} />
        <StatCard tone="orange" label="Ngày thấp hoặc cao hơn định mức" value={off} />
        <StatCard tone="gray" label="Ngày chưa đủ dữ liệu" value={noData} />
      </div>
      <section className="card">
        <div className="table-wrap">
          <table className="table table--grid table--wrap-head td-day-table">
            <thead>
              <tr>
                <th rowSpan={2}>Ngày</th>
                <th rowSpan={2} className="num">
                  Năng lượng (kcal)
                </th>
                <th rowSpan={2} className="num">
                  % đạt
                </th>
                <th colSpan={2} className="center td-col-p">
                  Đạm (g)
                </th>
                <th colSpan={2} className="center td-col-l">
                  Béo (g)
                </th>
                <th rowSpan={2} className="num td-col-g">
                  Tinh bột (g)
                </th>
                <th rowSpan={2} className="money">
                  Tiền ăn
                </th>
                <th rowSpan={2}>Đánh giá</th>
              </tr>
              <tr>
                <th className="num td-col-p">Động vật</th>
                <th className="num td-col-p">Thực vật</th>
                <th className="num td-col-l">Động vật</th>
                <th className="num td-col-l">Thực vật</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ day, i, sum, status }) => {
                const head = (
                  <td className="nowrap">
                    <span className="fw-600">{WEEKDAY_LABELS[i]}</span> <span className="muted">{formatDate(day.date)}</span>
                  </td>
                );
                if (day.holiday || !sum)
                  return (
                    <tr key={day.date}>
                      {head}
                      <td colSpan={COLS - 1} className="muted">
                        {day.holiday ? `Nghỉ: ${day.note || 'không tổ chức ăn'}` : 'Chưa có thực đơn'}
                      </td>
                    </tr>
                  );
                const t = sum.totals;
                const active = day.date === date;
                return (
                  <tr
                    key={day.date}
                    className={`row-click ${active ? 'td-day-row--active' : ''}`}
                    aria-selected={active}
                    {...clickableRowProps(() => onSelect(day))}
                  >
                    {head}
                    <td className="num">
                      <span className="td-tag td-tag--orange">{g(sum.nutrients.kcal.value)}</span>
                    </td>
                    <td className="num">{sum.nutrients.kcal.attainment != null ? `${sum.nutrients.kcal.attainment}%` : '—'}</td>
                    <td className="num">{g(t.animalProtein)}</td>
                    <td className="num">{g(t.plantProtein)}</td>
                    <td className="num">{g(t.animalLipid)}</td>
                    <td className="num">{g(t.plantLipid)}</td>
                    <td className="num">{g(t.glucid)}</td>
                    <td className="money nowrap">
                      <span className={`td-tag ${sum.overPrice ? 'td-tag--orange' : 'td-tag--green'}`}>{formatMoney(sum.cost)}</span>
                    </td>
                    <td>
                      <NormStatusChip status={status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
