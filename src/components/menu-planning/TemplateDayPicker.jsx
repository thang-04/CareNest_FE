import { WEEKDAY_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { TEMPLATE_WEEKDAYS, TEMPLATE_WEEKS } from '@/utils/menu-planning/menuTemplateGrid';

/**
 * Chọn ngày trong bộ mẫu 4 tuần: hàng tab tuần, bên dưới các thứ 2–6. `counts` ('weekNo-weekday' → số món) để
 * đánh dấu ngày đã có món; `value` = { weekNo, weekday }.
 */
export function TemplateDayPicker({ value, onChange, counts = {} }) {
  return (
    <div className="td-tpl-days">
      <div className="tabs tabs--pill" role="tablist" aria-label="Tuần trong bộ mẫu">
        {TEMPLATE_WEEKS.map((weekNo) => (
          <button
            key={weekNo}
            type="button"
            role="tab"
            aria-selected={weekNo === value.weekNo}
            className={`tab ${weekNo === value.weekNo ? 'tab--active' : ''}`}
            onClick={() => onChange({ ...value, weekNo })}
          >
            Tuần {weekNo}
          </button>
        ))}
      </div>
      <div className="tabs tabs--pill" role="tablist" aria-label="Ngày trong tuần">
        {TEMPLATE_WEEKDAYS.map((weekday) => {
          const n = counts[`${value.weekNo}-${weekday}`] || 0;
          return (
            <button
              key={weekday}
              type="button"
              role="tab"
              aria-selected={weekday === value.weekday}
              className={`tab ${weekday === value.weekday ? 'tab--active' : ''}`}
              onClick={() => onChange({ ...value, weekday })}
            >
              {WEEKDAY_LABELS[weekday - 1]}
              {n > 0 && <span className="muted"> · {n}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
