import { Tabs } from '@/components/ui/Tabs';
import { WEEKDAY_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { TEMPLATE_WEEKDAYS, TEMPLATE_WEEKS } from '@/utils/menu-planning/menuTemplateGrid';

/**
 * Chọn ngày trong bộ mẫu 4 tuần: nhóm tab "Tuần" và nhóm tab "Ngày" (thứ 2–6, số món là chấm đếm của tab) cạnh nhau,
 * xuống dòng khi hẹp. `counts` ('weekNo-weekday' → số món); `value` = { weekNo, weekday }.
 */
export function TemplateDayPicker({ value, onChange, counts = {}, oneWeek = false }) {
  const weeks = TEMPLATE_WEEKS.map((n) => ({ key: n, label: `Tuần ${n}` }));
  const days = TEMPLATE_WEEKDAYS.map((d) => ({
    key: d,
    label: WEEKDAY_LABELS[d - 1],
    count: counts[`${value.weekNo}-${d}`] || null,
  }));
  return (
    <div className="td-tpl-days">
      {!oneWeek && (
        <Tabs items={weeks} value={value.weekNo} onChange={(weekNo) => onChange({ ...value, weekNo })} ariaLabel="Tuần trong bộ mẫu" />
      )}
      <Tabs items={days} value={value.weekday} onChange={(weekday) => onChange({ ...value, weekday })} ariaLabel="Ngày trong tuần" />
    </div>
  );
}
