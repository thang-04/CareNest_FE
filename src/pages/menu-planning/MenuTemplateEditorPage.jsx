import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Save, Sparkles } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button, ErrorState, LoadingState, TextField } from '@/components';
import { usePageReadOnly } from '@/contexts/PageReadOnlyContext';
import { FormField } from '@/components/form/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { NoManageAccess, RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { TemplateMealSection } from '@/components/menu-planning/TemplateMealSection';
import { AddDishesModal } from '@/components/menu-planning/AddDishesModal';
import { MealNutritionCard } from '@/components/menu-planning/MealNutritionCard';
import { MenuAiDailyModal } from '@/components/menu-planning/MenuAiDailyModal';
import { TemplateHead } from '@/pages/menu-planning/MenuTemplateListPage';
import { useActiveDishes, useBeAgeGroups, useMealPlan, useMenuStatistics } from '@/hooks/menu-planning/useMealPlan';
import { useMenuTemplate } from '@/hooks/menu-planning/useMenuTemplates';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { menuTemplateApi } from '@/services/menuTemplateApi';
import { PERMISSIONS } from '@/models/bePermissions';
import { MEAL_BLOCK, MEAL_BLOCK_LABELS, MEAL_SESSION_LABELS, RECORD_STATUS, mondayOf } from '@/models/menu-planning/menuPlanningConstants';
import { hasBePermission } from '@/utils/bePermissions';
import { templateCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { blockSessions } from '@/utils/menu-planning/mealPlanGrid';
import { ageGroupOptions } from '@/utils/menu-planning/menuStatistics';
import { TemplateDayPicker } from '@/components/menu-planning/TemplateDayPicker';
import {
  DEFAULT_DAY,
  TEMPLATE_KIND,
  TEMPLATE_KIND_LABELS,
  dayCounts,
  dayItems,
  hasTemplateDays,
  itemsBySession,
  sameDay,
  templateKind,
  toStatisticsItems,
  toTemplateRequest,
} from '@/utils/menu-planning/menuTemplateGrid';
import { fillTemplateDay } from '@/utils/menu-planning/menuAiDraft';
import { todayInput } from '@/utils/format';
import '@/styles/modules/menu-planning.css';

const EMPTY = { name: '', seasonLabel: '', block: MEAL_BLOCK.KINDERGARTEN, items: [] };
const BLOCK_OPTIONS = Object.values(MEAL_BLOCK).map((b) => ({ value: b, label: MEAL_BLOCK_LABELS[b] }));
const toForm = (data) => ({ ...data, items: data.items.map((item) => ({ ...item, dishId: String(item.dishId) })) });

/**
 * Lập / sửa mẫu thực đơn ngày, tuần hoặc tháng (NUT-13): tên, nhãn mùa, khối; mỗi bữa của khối một khối món, mở món xem thành phần;
 * bảng dinh dưỡng 1 trẻ / ngày theo nhóm tuổi do BE tính trên các món đang chọn (kể cả chưa lưu).
 */
export default function MenuTemplateEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useMenuTemplate(id);
  const { dishes } = useActiveDishes();
  const { ageGroups } = useBeAgeGroups();
  // Mẫu mới chưa có bữa / nhóm tuổi từ BE: lấy theo cấu hình trường qua kế hoạch tuần hiện tại
  const weekQ = useMealPlan(id ? null : mondayOf(todayInput()));
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [adding, setAdding] = useState(null);
  const [ageGroupId, setAgeGroupId] = useState('');
  const [day, setDay] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    setForm(data ? toForm(data) : EMPTY);
  }, [data]);

  const editable = id ? !!data?.canEdit : hasBePermission(user, PERMISSIONS.MENU_MANAGE);
  // Sửa công thức món là quyền danh mục (NUTRITION_MANAGE), khác quyền sửa mẫu (MENU_MANAGE): form món chặn nếu thiếu
  const canEditRecipe = hasBePermission(user, PERMISSIONS.NUTRITION_MANAGE);
  const sessions = data?.sessions?.length && data.block === form.block ? data.sessions : blockSessions(weekQ.data, form.block);
  const groupIds =
    data?.ageGroupIds?.length && data.block === form.block
      ? data.ageGroupIds
      : (weekQ.data?.blocks || []).find((b) => b.block === form.block)?.ageGroupIds;
  const groups = useMemo(() => ageGroupOptions(groupIds, ageGroups), [groupIds, ageGroups]);
  const currentGroup = groups.some((g) => g.id === ageGroupId) ? ageGroupId : groups[0]?.id;
  // Bộ 4 tuần (BE hiện tại): sửa từng ngày của bộ; mẫu mới cũng bắt đầu ở Tuần 1 · Thứ Hai
  const dayMode = !form.items.length || hasTemplateDays(form.items);
  // Loại chọn lúc tạo đi theo URL; mở lại mẫu đã lưu thì suy từ các ngày có món
  const kind = TEMPLATE_KIND[params.get('kind')] || (id ? templateKind(data?.items) : TEMPLATE_KIND.MONTH);
  const kindLabel = TEMPLATE_KIND_LABELS[kind];
  const firstDay = useMemo(() => {
    const first = [...form.items].sort((a, b) => a.weekNo - b.weekNo || a.weekday - b.weekday)[0];
    return first?.weekNo != null ? { weekNo: first.weekNo, weekday: first.weekday } : DEFAULT_DAY;
  }, [form.items]);
  const currentDay = dayMode ? day || firstDay : null;
  const shownItems = useMemo(() => dayItems(form.items, currentDay), [form.items, currentDay]);
  const bySession = itemsBySession(shownItems);
  const statsItems = useMemo(() => toStatisticsItems(shownItems).map((i) => ({ ...i, dishId: Number(i.dishId) })), [shownItems]);
  const statsQ = useMenuStatistics(currentGroup && statsItems.length ? { ageGroupId: Number(currentGroup), items: statsItems } : null);
  // Đổi ngày/nhóm tuổi: giữ số liệu lần trước (làm mờ) tới khi BE trả số mới, không nhấp nháy khung chờ
  const shownStats = statsQ.data ?? statsQ.stale;
  const dirty = JSON.stringify(toTemplateRequest(form)) !== JSON.stringify(toTemplateRequest(data ? toForm(data) : EMPTY));
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Nhập tên mẫu.';
    setErrors(next);
    if (Object.keys(next).length) return false;
    setBusy(true);
    try {
      const saved = await menuTemplateApi.saveTemplate(id, toTemplateRequest(form));
      toast.success('Đã lưu mẫu thực đơn.');
      if (id) reload({ silent: true });
      else navigate(`/menu/templates/${saved.id}?kind=${kind}`, { replace: true });
      return true;
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Chưa lưu được mẫu');
      return false;
    } finally {
      setBusy(false);
    }
  };
  const guard = useLeaveGuard({ when: dirty && !busy, onSave: save });

  const toggleStatus = async () => {
    setBusy(true);
    try {
      const next = data.status === RECORD_STATUS.ACTIVE ? RECORD_STATUS.INACTIVE : RECORD_STATUS.ACTIVE;
      await menuTemplateApi.setTemplateStatus(id, next);
      toast.success(next === RECORD_STATUS.ACTIVE ? 'Đã dùng lại mẫu.' : 'Đã ngừng dùng mẫu.');
      reload({ silent: true });
    } catch (err) {
      toast.error(err, 'Chưa đổi được trạng thái');
    } finally {
      setBusy(false);
    }
  };

  // Lưu món đã chọn của một bữa: giữ thứ tự món cũ, thêm món mới ở cuối
  const saveMeal = (session, picked) => {
    setForm((f) => ({
      ...f,
      items: [
        ...f.items.filter((i) => !(i.session === session && sameDay(i, currentDay))),
        ...picked.map((d) => ({ ...(currentDay || {}), session, dishId: String(d.id), dishName: d.name, dishType: d.type })),
      ],
    }));
    setAdding(null);
  };
  const removeDish = (session, dishId) =>
    set(
      'items',
      form.items.filter((i) => !(i.session === session && i.dishId === String(dishId) && sameDay(i, currentDay))),
    );

  const crumbs = templateCrumbs(id ? data?.name || 'Mẫu thực đơn' : `Tạo ${kindLabel.toLowerCase()}`);
  const canCreate = hasBePermission(user, PERMISSIONS.MENU_MANAGE);
  const { reason: viewOnlyReason } = usePageReadOnly();
  const body = () => {
    if (id && error) return <ErrorState error={error} onRetry={reload} />;
    if (id && (loading || !data)) return <LoadingState />;
    // Tạo mẫu cần MENU_MANAGE: thiếu quyền thì báo như màn thêm thực phẩm, không mở form trống
    if (!id && !canCreate) return <NoManageAccess />;
    return (
      <div className="td-tpl-editor">
        <section className="card">
          <div className="card__header">
            <div>
              <h2 className="card__title">{id ? data.name : `${kindLabel} mới`}</h2>
              <span className="text-sm muted">Sửa mẫu không đổi các tuần đã điền món từ mẫu.</span>
            </div>
            <div className="page__actions">
              {id && data.status !== RECORD_STATUS.ACTIVE && <RecordStatusBadge status={data.status} />}
              {editable && id && (
                <Button disabled={busy} onClick={toggleStatus}>
                  {data.status === RECORD_STATUS.ACTIVE ? 'Ngừng dùng' : 'Dùng lại'}
                </Button>
              )}
              {editable && (
                <Button disabled={busy} onClick={() => setAiOpen(true)}>
                  <Sparkles size={16} /> AI gợi ý ngày
                </Button>
              )}
              <Button
                variant="primary"
                icon={Save}
                disabled={busy || (id && !dirty)}
                disabledReason={editable ? undefined : viewOnlyReason}
                onClick={save}
              >
                Lưu mẫu
              </Button>
            </div>
          </div>
          <div className="card__body td-tpl-form">
            <FormField label="Tên mẫu" required error={errors.name}>
              <TextField
                className="input"
                maxLength={100}
                value={form.name}
                disabled={!editable}
                placeholder="Ví dụ: Mùa đông · Ngày 1"
                onChange={(e) => set('name', e.target.value)}
              />
            </FormField>
            <FormField label="Khối" required hint={id ? 'Không đổi được khối sau khi tạo' : undefined}>
              <SearchSelect
                options={BLOCK_OPTIONS}
                value={form.block}
                disabled={!editable || !!id}
                ariaLabel="Khối"
                onChange={(b) => setForm((f) => ({ ...f, block: b, items: [] }))}
              />
            </FormField>
            <FormField label="Nhãn mùa" error={errors.seasonLabel} hint="Ví dụ: Mùa đông, Mùa hè">
              <TextField
                className="input"
                maxLength={50}
                value={form.seasonLabel}
                disabled={!editable}
                onChange={(e) => set('seasonLabel', e.target.value)}
              />
            </FormField>
          </div>
        </section>
        {dayMode && kind !== TEMPLATE_KIND.DAY && (
          <TemplateDayPicker value={currentDay} onChange={setDay} counts={dayCounts(form.items)} oneWeek={kind === TEMPLATE_KIND.WEEK} />
        )}
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
            onRemove={(dishId) => removeDish(session, dishId)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="page td-sections">
      <TemplateHead crumbs={crumbs} canCreate={canCreate && !!id} readOnly={!!data && !editable} />
      {body()}
      {/* Không có quyền tạo thì body đã báo; không hiện thêm bảng dinh dưỡng trống */}
      {(id ? data : canCreate) && (
        <MealNutritionCard
          ageGroups={groups}
          ageGroupId={currentGroup}
          onAgeGroup={setAgeGroupId}
          statsQ={{ ...statsQ, data: shownStats }}
          hasItems={shownItems.length > 0}
        />
      )}
      {adding && (
        <AddDishesModal
          title="Thêm món ăn"
          subtitle={`${MEAL_SESSION_LABELS[adding] || adding} · ${form.name || `${kindLabel} mới`}`}
          dishes={dishes}
          selectedIds={(bySession[adding] || []).map((i) => i.dishId)}
          ageGroup={ageGroups.find((g) => String(g.id) === String(currentGroup))}
          onSave={(picked) => saveMeal(adding, picked)}
          onClose={() => setAdding(null)}
        />
      )}
      {editable && (
        <MenuAiDailyModal
          open={aiOpen}
          onClose={() => setAiOpen(false)}
          block={form.block}
          seasonLabel={form.seasonLabel}
          dayLabel={currentDay && kind !== TEMPLATE_KIND.DAY ? `Tuần ${currentDay.weekNo} · thứ ${currentDay.weekday + 1}` : 'mẫu này'}
          onFill={(draft) => set('items', fillTemplateDay(form.items, currentDay, draft))}
        />
      )}
      <LeaveConfirmModal {...guard.modal} />
    </div>
  );
}
