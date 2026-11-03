import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb, ErrorState, LoadingState } from '@/components';
import { FormField } from '@/components/form/FormField';
import { MealPlanGrid } from '@/components/menu-planning/MealPlanGrid';
import { RecordStatusBadge } from '@/components/menu-planning/MenuBadges';
import { useActiveDishes, useMealPlan } from '@/hooks/menu-planning/useMealPlan';
import { useMenuTemplate } from '@/hooks/menu-planning/useMenuTemplates';
import { menuTemplateApi } from '@/services/menuTemplateApi';
import { PERMISSIONS } from '@/models/bePermissions';
import { MEAL_BLOCK, MEAL_BLOCK_LABELS, RECORD_STATUS, mondayOf } from '@/models/menu-planning/menuPlanningConstants';
import { hasBePermission } from '@/utils/bePermissions';
import { templateCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { blockSessions } from '@/utils/menu-planning/mealPlanGrid';
import { todayInput } from '@/utils/format';
import { statisticsHref } from '@/utils/menu-planning/menuStatistics';
import { applyWeekDraft, TEMPLATE_WEEKS, toTemplateRequest, weekDraft, weekItemCounts } from '@/utils/menu-planning/menuTemplateGrid';
import '@/styles/modules/menu-planning.css';

const EMPTY = { name: '', seasonLabel: '', block: MEAL_BLOCK.KINDERGARTEN, items: [] };

/** Lập/sửa bộ thực đơn mẫu 4 tuần (NUT-13): tên, nhãn mùa, khối; mỗi tuần một lưới thứ 2–6 × bữa như kế hoạch tuần. */
export default function MenuTemplateEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useMenuTemplate(id);
  const { dishes } = useActiveDishes();
  // Bộ mới chưa có bữa từ BE: lấy bữa của khối theo cấu hình trường qua kế hoạch tuần hiện tại
  const weekQ = useMealPlan(id ? null : mondayOf(todayInput()));
  const [form, setForm] = useState(EMPTY);
  const [week, setWeek] = useState(1);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (data) setForm({ ...data, items: data.items.map((item) => ({ ...item, dishId: String(item.dishId) })) });
  }, [data]);

  const editable = id ? !!data?.canEdit : hasBePermission(user, PERMISSIONS.MENU_MANAGE);
  const sessions = data?.sessions?.length ? data.sessions : blockSessions(weekQ.data, form.block);
  const draft = useMemo(() => weekDraft(form.items, week, form.block), [form.items, week, form.block]);
  const counts = weekItemCounts(form.items);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Nhập tên bộ thực đơn.';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const saved = await menuTemplateApi.saveTemplate(id, toTemplateRequest(form));
      toast.success('Đã lưu bộ thực đơn mẫu.');
      if (id) reload({ silent: true });
      else navigate(`/menu/templates/${saved.id}`, { replace: true });
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err, 'Chưa lưu được bộ thực đơn mẫu');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    setBusy(true);
    try {
      const next = data.status === RECORD_STATUS.ACTIVE ? RECORD_STATUS.INACTIVE : RECORD_STATUS.ACTIVE;
      await menuTemplateApi.setTemplateStatus(id, next);
      toast.success(next === RECORD_STATUS.ACTIVE ? 'Đã dùng lại bộ mẫu.' : 'Đã ngừng dùng bộ mẫu.');
      reload({ silent: true });
    } catch (err) {
      toast.error(err, 'Chưa đổi được trạng thái');
    } finally {
      setBusy(false);
    }
  };

  if (id && error)
    return (
      <div className="page">
        <Breadcrumb items={templateCrumbs('Bộ mẫu')} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  if (id && (loading || !data))
    return (
      <div className="page">
        <Breadcrumb items={templateCrumbs('Bộ mẫu')} />
        <LoadingState />
      </div>
    );

  return (
    <div className="page td-sections">
      <Breadcrumb items={templateCrumbs(id ? data.name : 'Thêm bộ mẫu')} />
      <div className="page__head">
        <div>
          <h1 className="page__title">{id ? data.name : 'Thêm bộ thực đơn mẫu'}</h1>
          <p className="page__desc">Chọn món cho từng tuần, thứ và bữa của khối. Kế hoạch tuần sẽ sao một tuần của bộ này.</p>
        </div>
        <div className="page__actions">
          {id && <RecordStatusBadge status={data.status} />}
          {!editable && (
            <span className="chip chip--gray">
              <Lock size={14} /> Chỉ xem
            </span>
          )}
          {editable && id && (
            <button type="button" className="btn" disabled={busy} onClick={toggleStatus}>
              {data.status === RECORD_STATUS.ACTIVE ? 'Ngừng dùng' : 'Dùng lại'}
            </button>
          )}
          {editable && (
            <button type="button" className="btn btn--primary" disabled={busy} onClick={save}>
              <Save size={16} /> Lưu bộ mẫu
            </button>
          )}
        </div>
      </div>

      <section className="card">
        <div className="card__body td-form-grid">
          <FormField label="Tên bộ thực đơn" required error={errors.name}>
            <input
              className="input"
              maxLength={100}
              value={form.name}
              disabled={!editable}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ví dụ: Bộ 4 tuần học kỳ I"
            />
          </FormField>
          <FormField label="Nhãn mùa" error={errors.seasonLabel} hint="Ví dụ: Mùa đông, Mùa hè">
            <input
              className="input"
              maxLength={50}
              value={form.seasonLabel}
              disabled={!editable}
              onChange={(e) => set('seasonLabel', e.target.value)}
            />
          </FormField>
          <FormField label="Khối" required hint={id ? 'Không đổi được khối sau khi tạo' : undefined}>
            <select
              className="select"
              value={form.block}
              disabled={!editable || !!id}
              onChange={(e) => setForm((f) => ({ ...f, block: e.target.value, items: [] }))}
            >
              {Object.values(MEAL_BLOCK).map((b) => (
                <option key={b} value={b}>
                  {MEAL_BLOCK_LABELS[b]}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div className="tabs tabs--pill" role="tablist" aria-label="Tuần trong bộ">
            {TEMPLATE_WEEKS.map((w) => (
              <button
                key={w}
                type="button"
                role="tab"
                aria-selected={w === week}
                className={`tab ${w === week ? 'tab--active' : ''}`}
                onClick={() => setWeek(w)}
              >
                Tuần {w} <span className="muted">({counts[w] || 0} món)</span>
              </button>
            ))}
          </div>
        </div>
        <MealPlanGrid
          draft={draft}
          plan={null}
          block={form.block}
          sessions={sessions}
          dishes={dishes}
          editable={editable}
          busy={busy}
          hideDates
          allowOff={false}
          dayLink={id ? (_day, i) => statisticsHref({ template: id, weekNo: week, weekday: i + 1 }) : undefined}
          onEdit={(fn) => setForm((f) => ({ ...f, items: applyWeekDraft(f.items, week, fn(weekDraft(f.items, week, f.block))) }))}
        />
      </section>
    </div>
  );
}
