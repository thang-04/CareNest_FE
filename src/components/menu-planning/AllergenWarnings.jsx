import { Link } from 'react-router-dom';
import { ShieldAlert, Info } from '@/components/ui/icons';
import { useMasterData } from '@/hooks/useMasterData';
import { mealsAllergens, sameAllergen } from '@/utils/menu-planning/menuCalculations';
import { RECORD_STATUS } from '@/models/menu-planning/menuPlanningConstants';
import { mealLabel } from '@/utils/menu-planning/nutritionSetup';

/**
 * GBR-MENU-03 / MSG40: warns when a dish contains an allergen recorded for children of the age group,
 * names the affected classes (counts only) and shows whether an alternative menu covers it.
 * contextRows: getAllergyContext(ageGroupId); allergyMenus: alternative menus of the base menu (if any).
 */
export function AllergenWarnings({ meals, catalog, ageGroupId, contextRows, allergyMenus = [], baseMenuId, canCreate = false }) {
  const md = useMasterData();
  const present = mealsAllergens(meals, catalog.dishById, catalog.foodById);
  const conflicts = present.map((p) => ({ ...p, ctx: contextRows.find((r) => sameAllergen(r.allergen, p.allergen)) })).filter((p) => p.ctx);
  const others = present.filter((p) => !conflicts.some((c) => c.allergen === p.allergen));
  if (!present.length) return null;

  const coverOf = (allergen) =>
    allergyMenus.filter((a) => a.status === RECORD_STATUS.ACTIVE && a.restrictions.some((r) => sameAllergen(r, allergen)));

  return (
    <>
      {conflicts.length > 0 && (
        <div className="alert alert--danger mb-12" role="status">
          <ShieldAlert size={18} />
          <div className="td-grow">
            <div className="fw-600">Phát hiện xung đột chế độ ăn. Hãy xem các trẻ bị ảnh hưởng và thực đơn thay thế.</div>
            <ul className="td-warn-list">
              {conflicts.map((c) => {
                const covers = coverOf(c.allergen);
                return (
                  <li key={c.allergen}>
                    <b>{c.allergen}</b> trong{' '}
                    {c.dishes.map((d) => `${d.name} (${mealLabel(catalog.nutritionSetups, ageGroupId, d.session)})`).join(', ')} –{' '}
                    {c.ctx.childCount} trẻ (
                    {c.ctx.classes
                      .map(
                        (cl) =>
                          `${cl.className} – ${md.campusById(cl.campusId)?.code || cl.campusId}${c.ctx.classes.length > 1 ? `: ${cl.count}` : ''}`,
                      )
                      .join('; ')}
                    ).{' '}
                    {baseMenuId &&
                      (covers.length ? (
                        <span>
                          Đã có suất thay thế:{' '}
                          {covers.map((a, i) => (
                            <span key={a.id}>
                              {i > 0 && ', '}
                              <Link to={`/menu/menus/${baseMenuId}/edit`}>{a.name}</Link>
                            </span>
                          ))}
                          .
                        </span>
                      ) : (
                        <span>
                          Chưa có suất thay thế. {canCreate && <Link to={`/menu/menus/${baseMenuId}/edit`}>Thêm suất thay thế</Link>}
                        </span>
                      ))}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div className="alert alert--info mb-12">
          <Info size={18} />
          <div>
            Thực đơn có món chứa {others.map((o) => o.allergen).join(', ')}; hiện chưa có trẻ nào trong nhóm tuổi được ghi nhận dị ứng với
            các thành phần này.
          </div>
        </div>
      )}
    </>
  );
}
