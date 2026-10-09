import { Link } from 'react-router-dom';
import { Scale } from '@/components/ui/icons';
import { MealsView } from '@/components/menu-planning/MealsView';
import { NormStatusChip } from '@/components/menu-planning/MenuBadges';
import { compareToNorm, mealsTotals } from '@/utils/menu-planning/menuCalculations';
import { formatDate } from '@/utils/format';
import { WEEKDAY_LABELS } from '@/models/menu-planning/menuPlanningConstants';

/** Overall status of a day: the worst nutrient row. */
export const dayNormStatus = (rows) =>
  rows.some((r) => r.status === 'NA') ? 'NA' : rows.find((r) => r.status === 'LOW' || r.status === 'HIGH')?.status || 'OK';

/** Days of a weekly menu with their dishes and energy (read-only). */
export function WeekDaysView({ wm, catalog, linkMenus = false, balanceLink = false }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 130 }}>Ngày</th>
            <th>Món ăn</th>
            <th className="right" style={{ width: 120 }}>
              Năng lượng
            </th>
            <th style={{ width: 170 }}>Dinh dưỡng</th>
            {balanceLink && (
              <th className="center" style={{ width: 70 }}>
                <span className="sr-only">Thao tác</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {wm.days.map((day, i) => {
            const result = day.holiday ? null : mealsTotals(day.meals, catalog.dishById, catalog.foodById, wm.ageGroupId);
            const rows = result ? compareToNorm(result.totals, wm.ageGroupId, result.missing.length > 0) : [];
            const menu = catalog.menuById[day.menuId];
            return (
              <tr key={day.date}>
                <td>
                  <div className="fw-600">{WEEKDAY_LABELS[i]}</div>
                  <div className="text-sm muted">{formatDate(day.date)}</div>
                </td>
                <td>
                  {day.holiday ? (
                    <span className="chip chip--gray">Nghỉ: {day.note || 'không tổ chức ăn'}</span>
                  ) : !day.menuId && !day.meals?.length ? (
                    <span className="text-danger text-sm">Chưa chọn thực đơn</span>
                  ) : (
                    <>
                      {menu && (
                        <div className="text-sm muted mb-8">
                          Từ{' '}
                          {linkMenus ? (
                            <Link to={`/menu/menus/${menu.id}`}>
                              {menu.code} · {menu.name}
                            </Link>
                          ) : (
                            menu.name
                          )}
                        </div>
                      )}
                      <MealsView meals={day.meals} catalog={catalog} compact />
                    </>
                  )}
                </td>
                <td className="right nowrap">{result ? `${result.totals.kcal.toLocaleString('vi-VN')} kcal` : '—'}</td>
                <td>{result ? <NormStatusChip status={dayNormStatus(rows)} /> : '—'}</td>
                {balanceLink && (
                  <td className="center">
                    {!day.holiday && (
                      <Link
                        className="icon-btn"
                        to={`/menu/nutrition?weeklyMenuId=${wm.id}&date=${day.date}`}
                        title="Xem cân đối dinh dưỡng"
                        aria-label={`Xem cân đối dinh dưỡng ${WEEKDAY_LABELS[i]}`}
                      >
                        <Scale size={17} />
                      </Link>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
