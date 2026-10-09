import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Sparkles, Info } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAllergyContext, useMenuAccess, useMenuCatalog, useWeeklyMenu, useWeeklyMenus } from '@/hooks/menu-planning/useMenuPlanning';
import { getAiDraft, saveWeeklyMenu } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { AiDraftLabel, NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { MealsView } from '@/components/menu-planning/MealsView';
import { WeekChecks } from '@/components/menu-planning/WeekChecks';
import { mealsTotals } from '@/utils/menu-planning/menuCalculations';
import { validateWeeklyMenu, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { weeklyCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { formatDate, todayInput } from '@/utils/format';
import { AGE_GROUPS } from '@/models/School';
import { RECORD_STATUS, WEEKDAY_LABELS, WEEKLY_STATUS, addDays, mondayOf, weekDates } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const blankDays = (weekStart) => weekDates(weekStart).map((date) => ({ date, holiday: false, note: '', menuId: '', meals: [] }));
const nextMonday = () => addDays(mondayOf(todayInput()), 7);

/**
 * Screen #85 – the Vice Principal (shared services) assigns sample menus to each school day; the system
 * checks the week rules. Publishing is done from the detail page after review (UC 6.8).
 */
export default function WeeklyMenuFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const access = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog({ live: false });
  const { item, loading, error, reload } = useWeeklyMenu(id, { live: false });
  const [form, setForm] = useState(() => ({
    ageGroupId: params.get('ageGroupId') || '',
    weekStart: nextMonday(),
    days: blankDays(nextMonday()),
    note: '',
  }));
  const [aiDraft, setAiDraft] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const { rows: allergyRows } = useAllergyContext(form.ageGroupId);
  const { items: sameGroup } = useWeeklyMenus({ ageGroupId: form.ageGroupId || '__none__' });
  const aiDraftId = params.get('aiDraftId');

  useEffect(() => {
    if (item) setForm({ ageGroupId: item.ageGroupId, weekStart: item.weekStart, days: item.days, note: item.note || '' });
  }, [item]);

  useEffect(() => {
    if (id || !aiDraftId) return;
    getAiDraft(aiDraftId, user)
      .then((d) => {
        setAiDraft(d);
        setForm((f) => ({ ...f, ageGroupId: d.ageGroupId, weekStart: d.weekStart, days: d.days }));
      })
      .catch((err) => toast.error(err.message, 'Không mở được bản nháp AI'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDraftId, id]);

  const menuOptions = useMemo(
    () =>
      catalog.menus
        .filter((m) => m.ageGroupId === form.ageGroupId && m.status === RECORD_STATUS.ACTIVE)
        .map((m) => {
          const kcal = mealsTotals(m.meals, catalog.dishById, catalog.foodById, m.ageGroupId).totals.kcal;
          return { value: m.id, label: `${m.code} · ${m.name} (${kcal.toLocaleString('vi-VN')} kcal)`, searchText: `${m.code} ${m.name}` };
        }),
    [catalog, form.ageGroupId],
  );
  const previous = sameGroup.find((w) => w.weekStart === addDays(form.weekStart, -7) && w.status === WEEKLY_STATUS.PUBLISHED);
  const locked = !!item?.replacesId;
  const errors = validateWeeklyMenu(form);
  const show = (k) => (submitted ? errors[k] : undefined);

  const setDay = (i, patch) => setForm((f) => ({ ...f, days: f.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const chooseMenu = (i, menuId) =>
    setDay(i, { menuId, meals: menuId ? JSON.parse(JSON.stringify(catalog.menuById[menuId]?.meals || [])) : [] });
  const changeWeek = (value) => {
    if (!value) return;
    const weekStart = mondayOf(value);
    setForm((f) => ({ ...f, weekStart, days: weekDates(weekStart).map((date, i) => ({ ...f.days[i], date })) }));
  };
  const changeAgeGroup = (ageGroupId) => setForm((f) => ({ ...f, ageGroupId, days: blankDays(f.weekStart) }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors)) return;
    setBusy(true);
    try {
      const saved = await saveWeeklyMenu(id, { ...form, aiDraftId: aiDraft?.id }, user);
      toast.success('Lưu thay đổi thành công.');
      navigate(`/menu/weekly/${saved.id}`);
    } catch (err) {
      toast.error(err.message, 'Không lưu được thay đổi');
      if (err.details?.existingId) navigate(`/menu/weekly/${err.details.existingId}`);
    } finally {
      setBusy(false);
    }
  };

  const title = id ? 'Sửa thực đơn tuần' : 'Lập thực đơn tuần';
  if (access.loading || loading || catLoading) return <LoadingState />;
  if (!access.canManage)
    return (
      <div className="page">
        <Breadcrumb items={weeklyCrumbs(title)} />
        <h1 className="page__title">{title}</h1>
        <NoManageAccess />
      </div>
    );
  if (id && (error || (item && item.status !== WEEKLY_STATUS.DRAFT)))
    return (
      <div className="page">
        <Breadcrumb items={weeklyCrumbs(title)} />
        {error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="alert alert--warning">
            <Info size={18} />
            <div>
              Thực đơn đã xuất bản không sửa trực tiếp. <Link to={`/menu/weekly/${id}`}>Mở thực đơn</Link> và chọn “Tạo phiên bản thay thế”.
            </div>
          </div>
        )}
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={weeklyCrumbs(title)} />
      <div className="page__head">
        <div className="row" style={{ gap: 12 }}>
          <h1 className="page__title">
            {id ? `Sửa thực đơn tuần ${item?.code || ''}` : title}
            {item?.version > 1 ? ` – phiên bản ${item.version}` : ''}
          </h1>
          {aiDraft && <AiDraftLabel />}
        </div>
        {!id && (
          <Link
            className="btn btn--outline-primary"
            to={`/menu/ai-suggestion?kind=WEEKLY${form.ageGroupId ? `&ageGroupId=${form.ageGroupId}` : ''}&weekStart=${form.weekStart}`}
          >
            <Sparkles size={16} /> Gợi ý sắp xếp bằng AI
          </Link>
        )}
      </div>
      {aiDraft && (
        <div className="alert alert--purple mb-16">
          <Sparkles size={18} />
          <div>
            Cách xếp thực đơn dưới đây do dịch vụ gợi ý tạo ra và <b>chưa có hiệu lực</b>. Hãy kiểm tra từng ngày, đổi thực đơn nếu cần rồi
            lưu nháp; thực đơn chỉ đến bếp và phụ huynh sau khi bạn xuất bản.
          </div>
        </div>
      )}
      {item?.changeReason && (
        <div className="alert alert--info mb-16">
          <Info size={18} />
          <div>
            Phiên bản thay thế cho thực đơn đã xuất bản. Lý do: {item.changeReason}. Khi xuất bản, phiên bản cũ được đánh dấu “Đã thay thế”
            và bếp được thông báo lại.
          </div>
        </div>
      )}
      <form onSubmit={submit} noValidate>
        <div className="card wizard-card">
          <div className="card__body td-form-grid">
            <FormField label="Nhóm tuổi" required error={show('ageGroupId')}>
              <select className="select" value={form.ageGroupId} onChange={(e) => changeAgeGroup(e.target.value)} disabled={locked}>
                <option value="">Chọn nhóm tuổi</option>
                {AGE_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Tuần (Thứ Hai)" required error={show('weekStart')} hint="Ngày chọn được tự chuyển về Thứ Hai của tuần">
              <input type="date" className="input" value={form.weekStart} onChange={(e) => changeWeek(e.target.value)} disabled={locked} />
            </FormField>
            <FormField label="Ghi chú">
              <input
                className="input"
                value={form.note}
                maxLength={300}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </FormField>
          </div>
        </div>

        <div className="card wizard-card mt-16">
          <div className="card__header">
            <div className="card__title">Thực đơn từng ngày</div>
          </div>
          <div className="card__body">
            {!form.ageGroupId ? (
              <div className="muted">Chọn nhóm tuổi để xếp thực đơn mẫu.</div>
            ) : (
              form.days.map((d, i) => (
                <div key={d.date} className="td-day-row">
                  <div className="td-day-row__date">
                    <div className="fw-600">{WEEKDAY_LABELS[i]}</div>
                    <div className="text-sm muted">{formatDate(d.date)}</div>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    {d.holiday ? (
                      <FormField label="Lý do nghỉ" required error={show(`day_${i}`)}>
                        <input
                          className="input"
                          value={d.note}
                          placeholder="Ví dụ: Nghỉ lễ"
                          onChange={(e) => setDay(i, { note: e.target.value })}
                        />
                      </FormField>
                    ) : (
                      <>
                        <SearchSelect
                          options={menuOptions}
                          value={d.menuId || ''}
                          onChange={(v) => chooseMenu(i, v)}
                          placeholder="Chọn thực đơn mẫu..."
                          ariaLabel={`Thực đơn ${WEEKDAY_LABELS[i]}`}
                          error={!!show(`day_${i}`)}
                        />
                        {show(`day_${i}`) && <span className="field__error">{errors[`day_${i}`]}</span>}
                        {d.meals?.length > 0 && (
                          <div className="mt-8">
                            <MealsView meals={d.meals} catalog={catalog} compact />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <label className="checkbox" style={{ paddingTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={d.holiday}
                      onChange={(e) =>
                        setDay(i, e.target.checked ? { holiday: true, menuId: '', meals: [] } : { holiday: false, note: '' })
                      }
                    />{' '}
                    Ngày nghỉ
                  </label>
                </div>
              ))
            )}
          </div>
        </div>

        {form.ageGroupId && (
          <div className="card mt-16">
            <div className="card__header">
              <div className="card__title">Kiểm tra quy tắc tuần</div>
            </div>
            <div className="card__body">
              <WeekChecks wm={form} catalog={catalog} previousDays={previous?.days || []} allergyRows={allergyRows} />
            </div>
          </div>
        )}

        <div className="page-actions">
          <button type="button" className="btn" onClick={() => navigate(id ? `/menu/weekly/${id}` : '/menu/weekly')}>
            <ArrowLeft size={16} /> Hủy
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner small /> : <Save size={16} />} Lưu nháp
          </button>
        </div>
      </form>
    </div>
  );
}
