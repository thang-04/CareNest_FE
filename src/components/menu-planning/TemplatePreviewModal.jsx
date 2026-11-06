import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from '@/components/ui/icons';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { TemplateMealSection } from '@/components/menu-planning/TemplateMealSection';
import { MealNutritionCard } from '@/components/menu-planning/MealNutritionCard';
import { useBeAgeGroups, useMenuStatistics } from '@/hooks/menu-planning/useMealPlan';
import { useMenuTemplate } from '@/hooks/menu-planning/useMenuTemplates';
import { MEAL_BLOCK_LABELS, SESSION_ORDER } from '@/models/menu-planning/menuPlanningConstants';
import { ageGroupOptions } from '@/utils/menu-planning/menuStatistics';
import { TemplateDayPicker } from '@/components/menu-planning/TemplateDayPicker';
import {
  DEFAULT_DAY,
  dayCounts,
  dayItems,
  hasTemplateDays,
  itemsBySession,
  toStatisticsItems,
} from '@/utils/menu-planning/menuTemplateGrid';

/**
 * Xem một mẫu ngày trong modal lớn: tên, khối, mùa; từng bữa với món và thành phần cho 1 trẻ; dinh dưỡng 1 trẻ / ngày
 * theo nhóm tuổi. Số do BE tính (`POST /nutrition/menu-statistics`). Sửa mở trang sửa.
 */
export function TemplatePreviewModal({ id, onClose }) {
  const { data, loading, error, reload } = useMenuTemplate(id);
  const { ageGroups } = useBeAgeGroups();
  const [ageGroupId, setAgeGroupId] = useState('');
  const [day, setDay] = useState(null);
  const allItems = useMemo(() => (data?.items || []).map((i) => ({ ...i, dishId: String(i.dishId) })), [data]);
  // Bộ 4 tuần: chỉ hiện một ngày (mặc định ngày đầu có món); mẫu một ngày: hiện hết
  const dayMode = hasTemplateDays(allItems);
  const firstDay = useMemo(() => {
    const first = [...allItems].sort((a, b) => a.weekNo - b.weekNo || a.weekday - b.weekday)[0];
    return first ? { weekNo: first.weekNo, weekday: first.weekday } : DEFAULT_DAY;
  }, [allItems]);
  const currentDay = dayMode ? day || firstDay : null;
  const items = useMemo(() => dayItems(allItems, currentDay), [allItems, currentDay]);
  const groups = useMemo(() => ageGroupOptions(data?.ageGroupIds, ageGroups), [data, ageGroups]);
  const currentGroup = groups.some((g) => g.id === ageGroupId) ? ageGroupId : groups[0]?.id;
  const statsItems = useMemo(() => toStatisticsItems(items).map((i) => ({ ...i, dishId: Number(i.dishId) })), [items]);
  const statsQ = useMenuStatistics(currentGroup && statsItems.length ? { ageGroupId: Number(currentGroup), items: statsItems } : null);
  const bySession = itemsBySession(items);
  const sessions = data?.sessions?.length ? data.sessions : SESSION_ORDER.filter((s) => bySession[s]);
  // null = BE đã trả số liệu nhưng không kèm thành phần món (bản BE chưa hỗ trợ); undefined = đang tải
  const ingredients = statsQ.data ? (statsQ.data.dishIngredients ?? null) : undefined;

  return (
    <Modal
      open
      size="xl"
      title={data?.name || 'Mẫu thực đơn ngày'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
          {data?.canEdit && (
            <Link className="btn btn--primary" to={`/menu/templates/${id}`}>
              <Pencil size={16} /> Sửa mẫu
            </Link>
          )}
        </>
      }
    >
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingState />
      ) : (
        <div className="td-tpl-preview">
          <div className="row row--wrap td-tpl-preview__meta">
            <span className="chip chip--blue">{MEAL_BLOCK_LABELS[data.block] || data.block}</span>
            {data.seasonLabel && <span className="chip chip--teal">{data.seasonLabel}</span>}
            {data.status !== 'ACTIVE' && <RecordStatusBadge status={data.status} />}
          </div>
          {dayMode && <TemplateDayPicker value={currentDay} onChange={setDay} counts={dayCounts(allItems)} />}
          {sessions.map((session) => (
            <TemplateMealSection
              key={session}
              session={session}
              items={bySession[session] || []}
              ingredients={ingredients}
              editable={false}
            />
          ))}
          <MealNutritionCard
            ageGroups={groups}
            ageGroupId={currentGroup}
            onAgeGroup={setAgeGroupId}
            statsQ={statsQ}
            hasItems={items.length > 0}
          />
        </div>
      )}
    </Modal>
  );
}
