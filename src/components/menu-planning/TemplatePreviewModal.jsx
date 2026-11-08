import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Pencil } from '@/components/ui/icons';
import { FormField } from '@/components/form/FormField';
import { Modal } from '@/components/ui/Modal';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { TemplateMealSection } from '@/components/menu-planning/TemplateMealSection';
import { MealNutritionCard } from '@/components/menu-planning/MealNutritionCard';
import { useToast } from '@/contexts/ToastContext';
import { useBeAgeGroups, useMenuStatistics } from '@/hooks/menu-planning/useMealPlan';
import { useMenuTemplate } from '@/hooks/menu-planning/useMenuTemplates';
import { useDishes, useFoods } from '@/hooks/menu-planning/useMenuPlanning';
import { menuTemplateApi } from '@/services/menuTemplateApi';
import { MEAL_BLOCK_LABELS, SESSION_ORDER } from '@/models/menu-planning/menuPlanningConstants';
import { ageGroupOptions, catalogIngredientLines } from '@/utils/menu-planning/menuStatistics';
import { TemplateDayPicker } from '@/components/menu-planning/TemplateDayPicker';
import {
  DEFAULT_DAY,
  TEMPLATE_KIND,
  TEMPLATE_NAME_MAX,
  copyTemplateName,
  dayCounts,
  dayItems,
  hasTemplateDays,
  itemsBySession,
  templateKind,
  toStatisticsItems,
  toTemplateRequest,
} from '@/utils/menu-planning/menuTemplateGrid';

/**
 * Xem một mẫu ngày trong modal lớn: tên, khối, mùa; từng bữa với món và thành phần cho 1 trẻ; dinh dưỡng 1 trẻ / ngày
 * theo nhóm tuổi. Số do BE tính (`POST /nutrition/menu-statistics`). Sửa mở trang sửa.
 * `duplicate`: xem trước để nhân bản, đặt tên mới rồi mới lưu; lưu xong gọi `onDuplicated()`.
 */
export function TemplatePreviewModal({ id, onClose, duplicate = false, onDuplicated }) {
  const toast = useToast();
  const { data, loading, error, reload } = useMenuTemplate(id);
  const [copyName, setCopyName] = useState(null);
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const newName = copyName ?? copyTemplateName(data?.name);
  const { ageGroups } = useBeAgeGroups();
  const [ageGroupId, setAgeGroupId] = useState('');
  const [day, setDay] = useState(null);
  const allItems = useMemo(() => (data?.items || []).map((i) => ({ ...i, dishId: String(i.dishId) })), [data]);
  // Bộ 4 tuần: chỉ hiện một ngày (mặc định ngày đầu có món); mẫu một ngày: hiện hết
  const dayMode = hasTemplateDays(allItems);
  const kind = templateKind(allItems);
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
  // Đổi ngày/nhóm tuổi: giữ số liệu lần trước (làm mờ) tới khi BE trả số mới, không nhấp nháy khung chờ
  const shownStats = statsQ.data ?? statsQ.stale;
  const shownQ = { ...statsQ, data: shownStats };
  const beIngredients = shownStats ? (shownStats.dishIngredients ?? null) : undefined;
  // BE chưa trả thành phần món (bản máy chủ cũ): dùng định lượng trong danh mục món để vẫn xem được tên thực phẩm, lượng ăn, thải bỏ
  const needFallback = beIngredients === null;
  const { items: dishes } = useDishes({});
  const { items: foods } = useFoods({});
  const groupCode = ageGroups.find((g) => String(g.id) === String(currentGroup))?.code;
  const ingredients = useMemo(
    () => (needFallback ? catalogIngredientLines(items, dishes, foods, groupCode) : beIngredients),
    [needFallback, items, dishes, foods, groupCode, beIngredients],
  );

  const saveCopy = async () => {
    if (!newName.trim()) {
      setNameError('Nhập tên mẫu.');
      return;
    }
    setSaving(true);
    try {
      await menuTemplateApi.saveTemplate(null, toTemplateRequest({ ...data, name: newName }));
      toast.success('Đã nhân bản mẫu.');
      onDuplicated?.();
    } catch (err) {
      setNameError(err.details?.name || '');
      toast.error(err, 'Chưa nhân bản được mẫu');
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="xl"
      title={duplicate ? 'Nhân bản mẫu' : data?.name || 'Mẫu thực đơn'}
      onClose={saving ? undefined : onClose}
      footer={
        duplicate ? (
          <>
            <button type="button" className="btn" disabled={saving} onClick={onClose}>
              Hủy
            </button>
            <button type="button" className="btn btn--primary" disabled={!data || saving} onClick={saveCopy}>
              {saving ? <Spinner small /> : <Copy size={16} />} Lưu bản sao
            </button>
          </>
        ) : (
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
        )
      }
    >
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading || !data ? (
        <LoadingState />
      ) : (
        <div className="td-tpl-preview">
          {duplicate && (
            <FormField label="Tên mẫu mới" required error={nameError}>
              <input
                className="input"
                value={newName}
                maxLength={TEMPLATE_NAME_MAX}
                disabled={saving}
                onChange={(e) => {
                  setCopyName(e.target.value);
                  setNameError('');
                }}
              />
            </FormField>
          )}
          <div className="row row--wrap td-tpl-preview__meta">
            <span className="chip chip--blue">{MEAL_BLOCK_LABELS[data.block] || data.block}</span>
            {data.seasonLabel && <span className="chip chip--teal">{data.seasonLabel}</span>}
            {data.status !== 'ACTIVE' && <RecordStatusBadge status={data.status} />}
          </div>
          {dayMode && kind !== TEMPLATE_KIND.DAY && (
            <TemplateDayPicker value={currentDay} onChange={setDay} counts={dayCounts(allItems)} oneWeek={kind === TEMPLATE_KIND.WEEK} />
          )}
          {sessions.map((session) => (
            <TemplateMealSection
              key={session}
              session={session}
              items={bySession[session] || []}
              ingredients={ingredients}
              loading={statsQ.loading}
              editable={false}
            />
          ))}
          <MealNutritionCard
            ageGroups={groups}
            ageGroupId={currentGroup}
            onAgeGroup={setAgeGroupId}
            statsQ={shownQ}
            hasItems={items.length > 0}
          />
        </div>
      )}
    </Modal>
  );
}
