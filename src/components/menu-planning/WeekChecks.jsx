import { CheckCircle2, AlertTriangle, XCircle } from '@/components/ui/icons';
import { useMasterData } from '@/hooks/useMasterData';
import { dayNormStatus } from '@/components/menu-planning/WeekDaysView';
import { compareToNorm, mealsAllergens, mealsTotals, repeatedMainDishes, sameAllergen } from '@/utils/menu-planning/menuCalculations';
import { weekBudgetCheck } from '@/utils/menu-planning/menuChecks';
import { formatDate } from '@/utils/format';
import { normScopeMeals } from '@/utils/menu-planning/nutritionSetup';
import { REPEAT_WINDOW_DAYS, RECORD_STATUS } from '@/models/menu-planning/menuPlanningConstants';

const Icon = ({ level }) =>
  level === 'ok' ? (
    <CheckCircle2 size={17} className="td-ok" />
  ) : level === 'bad' ? (
    <XCircle size={17} className="td-bad" />
  ) : (
    <AlertTriangle size={17} className="td-warn" />
  );

/**
 * Week rules of the Weekly Menu Form (screen #85): every school day has a menu, holidays skipped,
 * main dishes not repeated within 7 days (flag only, GBR-MENU-04), weekly budget, allergens (GBR-MENU-03)
 * and the nutrition reference of each day (GBR-MENU-02).
 */
export function WeekChecks({ wm, catalog, previousDays = [], allergyRows = [] }) {
  const md = useMasterData();
  const school = wm.days.filter((d) => !d.holiday);
  const missing = school.filter((d) => !d.menuId && !d.meals?.length);
  const repeats = repeatedMainDishes([...previousDays, ...wm.days], catalog.dishById).filter((r) =>
    r.dates.some((x) => wm.days.some((d) => d.date === x)),
  );
  const perDay = school.map((d) => ({
    day: d,
    result: mealsTotals(normScopeMeals(d.meals, catalog.nutritionSetups, wm.ageGroupId), catalog.dishById, catalog.foodById, wm.ageGroupId),
  }));
  const budgetCheck = weekBudgetCheck({
    days: perDay.map((x) => ({ date: x.day.date, cost: x.result.cost })),
    ageGroupId: wm.ageGroupId,
    weekStart: wm.weekStart,
    catalog,
  });
  const offNorm = perDay.filter(
    (x) =>
      x.day.meals?.length &&
      dayNormStatus(compareToNorm(x.result.totals, wm.ageGroupId, x.result.missing.length > 0, catalog.norms)) !== 'OK',
  );

  const allergyIssues = [];
  school.forEach((d) =>
    mealsAllergens(d.meals, catalog.dishById, catalog.foodById).forEach((row) => {
      const ctx = allergyRows.find((r) => sameAllergen(r.allergen, row.allergen));
      if (!ctx) return;
      const covered = catalog.allergyMenus.some(
        (a) => a.baseMenuId === d.menuId && a.status === RECORD_STATUS.ACTIVE && a.restrictions.some((r) => sameAllergen(r, row.allergen)),
      );
      allergyIssues.push({ date: d.date, allergen: row.allergen, dishes: row.dishes.map((x) => x.name), ctx, covered });
    }),
  );

  return (
    <ul className="td-check-list">
      <li>
        <Icon level={missing.length ? 'bad' : 'ok'} />
        <div>
          {missing.length
            ? `Còn ${missing.length} ngày học chưa chọn thực đơn: ${missing.map((d) => formatDate(d.date)).join(', ')}.`
            : `Đủ thực đơn cho ${school.length} ngày học${wm.days.length > school.length ? `, ${wm.days.length - school.length} ngày nghỉ được bỏ qua` : ''}.`}
        </div>
      </li>
      <li>
        <Icon level={repeats.length ? 'warn' : 'ok'} />
        <div>
          {repeats.length
            ? `Món mặn lặp lại trong ${REPEAT_WINDOW_DAYS} ngày: ${repeats.map((r) => `${r.name} (${r.dates.map(formatDate).join(', ')})`).join('; ')}. Vẫn được phép nhưng nên đổi món.`
            : `Không có món mặn lặp lại trong ${REPEAT_WINDOW_DAYS} ngày.`}
        </div>
      </li>
      <li>
        <Icon level={budgetCheck.level} />
        <div>{budgetCheck.text}</div>
      </li>
      <li>
        <Icon level={offNorm.length ? 'warn' : 'ok'} />
        <div>
          {offNorm.length
            ? `${offNorm.length} ngày chưa nằm trong định mức dinh dưỡng tham khảo hoặc thiếu số liệu: ${offNorm.map((x) => formatDate(x.day.date)).join(', ')}.`
            : 'Các ngày đều nằm trong định mức dinh dưỡng tham khảo.'}
        </div>
      </li>
      <li>
        <Icon level={allergyIssues.some((x) => !x.covered) ? 'bad' : allergyIssues.length ? 'warn' : 'ok'} />
        <div>
          {allergyIssues.length === 0 ? (
            'Không có món chứa thành phần mà trẻ trong nhóm tuổi bị dị ứng.'
          ) : (
            <>
              Phát hiện xung đột chế độ ăn. Hãy xem các trẻ bị ảnh hưởng và thực đơn thay thế:
              <ul className="td-warn-list">
                {allergyIssues.map((x) => (
                  <li key={`${x.date}_${x.allergen}`}>
                    {formatDate(x.date)}: <b>{x.allergen}</b> trong {x.dishes.join(', ')} – {x.ctx.childCount} trẻ (
                    {x.ctx.classes.map((c) => `${c.className} ${md.campusById(c.campusId)?.code || ''}`).join(', ')}) –{' '}
                    {x.covered ? (
                      <span className="td-ok">đã có thực đơn thay thế</span>
                    ) : (
                      <span className="td-bad">chưa có thực đơn thay thế</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </li>
    </ul>
  );
}
