import { useState } from 'react';
import { TemplateMealSection } from '@/components/menu-planning/TemplateMealSection';
import { AddDishesModal } from '@/components/menu-planning/AddDishesModal';
import { MEAL_SESSION_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { itemsBySession } from '@/utils/menu-planning/menuTemplateGrid';

/**
 * Món của một khối trong một ngày theo từng bữa, cho modal "Sửa ngày" của Kế hoạch tuần (chỉ chọn món; dinh dưỡng cân đối ở
 * màn Cân đối khẩu phần). `onChange(items)` nhận món mới của khối trong ngày; không truyền ⇒ chỉ xem.
 */
export function DayBalanceView({ items, sessions, dishes, dayTitle, canEditRecipe, onChange }) {
  const [adding, setAdding] = useState(null);
  const editable = !!onChange;
  const bySession = itemsBySession(items);

  // Món đã chọn của một bữa: giữ món cũ còn chọn theo thứ tự, thêm món mới ở cuối
  const saveMeal = (session, picked) => {
    const ids = picked.map((d) => String(d.id));
    const kept = items.filter((i) => i.session !== session || ids.includes(String(i.dishId)));
    const have = new Set(kept.filter((i) => i.session === session).map((i) => String(i.dishId)));
    const added = picked
      .filter((d) => !have.has(String(d.id)))
      .map((d) => ({ session, dishId: String(d.id), dishName: d.name || '', dishType: d.type || '' }));
    onChange([...kept, ...added]);
    setAdding(null);
  };
  const remove = (session, dishId) => onChange(items.filter((i) => !(i.session === session && String(i.dishId) === String(dishId))));

  return (
    <div>
      {sessions.map((session) => (
        <TemplateMealSection
          key={session}
          session={session}
          items={bySession[session] || []}
          editable={editable}
          canEditRecipe={canEditRecipe}
          dishesOnly
          onAdd={() => setAdding(session)}
          onRemove={(dishId) => remove(session, dishId)}
        />
      ))}
      {adding && (
        <AddDishesModal
          title="Thêm món ăn"
          subtitle={`${MEAL_SESSION_LABELS[adding] || adding}${dayTitle ? ` · ${dayTitle}` : ''}`}
          dishes={dishes}
          selectedIds={(bySession[adding] || []).map((i) => i.dishId)}
          hideKcal
          onSave={(picked) => saveMeal(adding, picked)}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}
