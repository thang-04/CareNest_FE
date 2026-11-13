import { WEEKDAY_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { Tabs } from '@/components/ui/Tabs';
import { TEMPLATE_WEEKDAYS, TEMPLATE_WEEKS } from '@/utils/menu-planning/menuTemplateGrid';

/**
 * Chọn ngày trong bộ mẫu 4 tuần: hàng tab tuần, bên dưới các thứ 2–6. `counts` ('weekNo-weekday' → số món) để
 * đánh dấu ngày đã có món; `value` = { weekNo, weekday }.
 */
export function TemplateDayPicker({ value, onChange, counts = {} }) {
  return (
    <div className="td-tpl-days">
      <Tabs
        variant="pill"
        items={TEMPLATE_WEEKS.map((weekNo) => ({ key: weekNo, label: `Tuần ${weekNo}` }))}
        value={value.weekNo}
        onChange={(weekNo) => onChange({ ...value, weekNo })}
        ariaLabel="Tuần trong bộ mẫu"
      />
      <Tabs
        variant="pill"
        items={TEMPLATE_WEEKDAYS.map((weekday) => {
          const n = counts[`${value.weekNo}-${weekday}`] || 0;
          return {
            key: weekday,
            label: (
              <>
                {WEEKDAY_LABELS[weekday - 1]}
                {n > 0 && <span className="muted"> · {n}</span>}
              </>
            ),
          };
        })}
        value={value.weekday}
        onChange={(weekday) => onChange({ ...value, weekday })}
        ariaLabel="Ngày trong tuần"
      />
    </div>
  );
}
