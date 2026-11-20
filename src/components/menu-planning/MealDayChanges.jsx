import { MEAL_BLOCK_LABELS, MEAL_SESSION_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { dayItemChanges } from '@/utils/menu-planning/mealPlanGrid';

const names = (list) => (list.length ? list.join(', ') : 'Không có món');

/** Ô (khối × bữa) có món đổi giữa hai bản của một ngày: món cũ gạch ngang, món mới bên cạnh. */
export function MealDayChanges({ beforeItems, afterItems, emptyText = 'Không có món nào thay đổi.' }) {
  const changes = dayItemChanges(beforeItems, afterItems);
  if (!changes.length) return <p className="text-sm muted td-flat">{emptyText}</p>;
  return (
    <ul className="td-day-changes">
      {changes.map((c) => (
        <li key={`${c.block}|${c.session}`} className="td-day-changes__row">
          <span className="muted">
            {MEAL_BLOCK_LABELS[c.block] || c.block} · {MEAL_SESSION_LABELS[c.session] || c.session}
          </span>
          <span>
            <del className="muted">{names(c.before)}</del>
            <span aria-hidden="true"> → </span>
            <span className="sr-only">đổi thành </span>
            <strong>{names(c.after)}</strong>
          </span>
        </li>
      ))}
    </ul>
  );
}
