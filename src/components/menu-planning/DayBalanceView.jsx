import { useMemo, useState } from 'react';
import { TemplateMealSection } from '@/components/menu-planning/TemplateMealSection';
import { MealNutritionCard } from '@/components/menu-planning/MealNutritionCard';
import { AddDishesModal } from '@/components/menu-planning/AddDishesModal';
import { useMenuStatistics } from '@/hooks/menu-planning/useMealPlan';
import { MEAL_SESSION_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import { dayStatisticsQuery } from '@/utils/menu-planning/mealPlanGrid';
import { itemsBySession } from '@/utils/menu-planning/menuTemplateGrid';

/**
 * Cân đối một ngày của một khối (bố cục MISA "Cân đối thực đơn"): bên trái mỗi bữa là món › thành phần cho 1 trẻ, bên phải
 * dinh dưỡng 1 trẻ / ngày so định mức theo nhóm tuổi. Số do BE tính qua `POST /nutrition/menu-statistics` trên món đang chọn
 * (kể cả chưa lưu). `onChange(items)` nhận món mới của khối trong ngày; không truyền ⇒ chỉ xem.
 * Dùng chung cho modal "Sửa ngày" của Kế hoạch tuần và màn Cân đối khẩu phần.
 */
export function DayBalanceView({ items, sessions, groups, ageGroups, dishes, date, dayTitle, canEditRecipe, onChange }) {
  const [ageGroupId, setAgeGroupId] = useState('');
  const [adding, setAdding] = useState(null);
  const editable = !!onChange;
  const currentGroup = groups.some((g) => g.id === ageGroupId) ? ageGroupId : groups[0]?.id;
  const query = useMemo(() => dayStatisticsQuery(items, currentGroup, date), [items, currentGroup, date]);
  const statsQ = useMenuStatistics(query);
  // Đổi món / nhóm tuổi: giữ số liệu cũ (làm mờ) tới khi BE trả số mới
  const shownStats = statsQ.data ?? statsQ.stale;
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
    <div className="td-day-balance">
      <div className="td-day-balance__meals">
        {sessions.map((session) => (
          <TemplateMealSection
            key={session}
            session={session}
            items={bySession[session] || []}
            ingredients={shownStats ? (shownStats.dishIngredients ?? null) : undefined}
            loading={statsQ.loading}
            editable={editable}
            canEditRecipe={canEditRecipe}
            onAdd={() => setAdding(session)}
            onRemove={(dishId) => remove(session, dishId)}
          />
        ))}
      </div>
      <div className="td-day-balance__nutrition">
        <MealNutritionCard
          ageGroups={groups}
          ageGroupId={currentGroup}
          onAgeGroup={setAgeGroupId}
          statsQ={{ ...statsQ, data: shownStats }}
          hasItems={items.length > 0}
          emptyText="Thêm món cho ngày này để xem dinh dưỡng."
        />
      </div>
      {adding && (
        <AddDishesModal
          title="Thêm món ăn"
          subtitle={`${MEAL_SESSION_LABELS[adding] || adding}${dayTitle ? ` · ${dayTitle}` : ''}`}
          dishes={dishes}
          selectedIds={(bySession[adding] || []).map((i) => i.dishId)}
          ageGroup={ageGroups.find((g) => String(g.id) === String(currentGroup))}
          onSave={(picked) => saveMeal(adding, picked)}
          onClose={() => setAdding(null)}
        />
      )}
    </div>
  );
}
