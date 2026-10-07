import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useAllergyContext, useAllergyMenu, useMenuAccess, useMenuCatalog } from '@/hooks/menu-planning/useMenuPlanning';
import { saveAllergyMenu } from '@/services/menu-planning/menuPlanningService';
import { useMasterData } from '@/hooks/useMasterData';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { AllergenChips, NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { MealsView } from '@/components/menu-planning/MealsView';
import { NutritionTable } from '@/components/menu-planning/NutritionTable';
import {
  applyReplacements,
  dishAllergens,
  mealsTotals,
  priceOn,
  restrictedConflicts,
  sameAllergen,
} from '@/utils/menu-planning/menuCalculations';
import { validateAllergyMenu, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { allergyMenuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import { ageGroupById } from '@/models/School';
import {
  ALLERGENS,
  ALLERGY_GROUP_LABELS,
  MEAL_SESSION_LABELS,
  RECORD_STATUS,
  RECORD_STATUS_LABELS,
} from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const REMOVE = '__REMOVE__';
const EMPTY = { name: '', baseMenuId: '', groupType: 'ALLERGY', restrictions: [], note: '', status: 'ACTIVE', replacements: [] };

/**
 * Screen #81 – the Vice Principal (shared services) configures an alternative menu for an affected group;
 * the system checks that no restricted allergen remains (MSG40) and shows the nutrition (UC 6.7).
 */
export default function AllergyMenuFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const md = useMasterData();
  const access = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog({ live: false });
  const { item, loading, error, reload } = useAllergyMenu(id, { live: false });
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    baseMenuId: params.get('baseMenuId') || '',
    restrictions: params.get('restriction') ? [params.get('restriction')] : [],
  }));
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const base = catalog.menuById[form.baseMenuId];
  const { rows: allergyRows } = useAllergyContext(base?.ageGroupId || '');

  useEffect(() => {
    if (item) setForm({ ...EMPTY, ...item });
  }, [item]);

  const menuOptions = useMemo(
    () =>
      catalog.menus
        .filter((m) => m.status === RECORD_STATUS.ACTIVE || m.id === form.baseMenuId)
        .map((m) => ({ value: m.id, label: `${m.code} · ${m.name}`, searchText: `${m.code} ${m.name}` })),
    [catalog.menus, form.baseMenuId],
  );
  const dishOptions = (exclude) =>
    catalog.dishes
      .filter((d) => d.status === RECORD_STATUS.ACTIVE && d.id !== exclude)
      .filter((d) => !dishAllergens(d, catalog.foodById).some((a) => form.restrictions.some((r) => sameAllergen(r, a))))
      .map((d) => ({ value: d.id, label: d.name }));

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const repOf = (session, dishId) => form.replacements.find((r) => r.session === session && r.originalDishId === dishId);
  const setRep = (session, dishId, value, portion) => {
    const others = form.replacements.filter((r) => !(r.session === session && r.originalDishId === dishId));
    if (!value) return set('replacements', others);
    set('replacements', [
      ...others,
      {
        session,
        originalDishId: dishId,
        replacementDishId: value === REMOVE ? null : value,
        portion: portion ?? repOf(session, dishId)?.portion ?? 1,
      },
    ]);
  };
  const toggle = (a) =>
    set('restrictions', form.restrictions.includes(a) ? form.restrictions.filter((x) => x !== a) : [...form.restrictions, a]);

  const effective = base ? applyReplacements(base.meals, form.replacements) : [];
  const conflicts = base ? restrictedConflicts(effective, form.restrictions, catalog.dishById, catalog.foodById) : [];
  const errors = validateAllergyMenu(form, catalog);
  const result = base ? mealsTotals(effective, catalog.dishById, catalog.foodById, base.ageGroupId) : null;
  const affected = allergyRows.filter((r) => form.restrictions.some((x) => sameAllergen(x, r.allergen)));
  const title = id ? 'Sửa thực đơn thay thế' : 'Tạo thực đơn thay thế';
  const show = (k) => (submitted ? errors[k] : undefined);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors)) return;
    setBusy(true);
    try {
      const saved = await saveAllergyMenu(id, form, user);
      toast.success('Lưu thay đổi thành công.');
      navigate(`/menu/allergy-menus/${saved.id}`);
    } catch (err) {
      toast.error(err.message, 'Không lưu được thay đổi');
    } finally {
      setBusy(false);
    }
  };

  if (access.loading || loading || catLoading) return <LoadingState />;
  if (!access.canManage)
    return (
      <div className="page">
        <Breadcrumb items={allergyMenuCrumbs(title)} />
        <h1 className="page__title">{title}</h1>
        <NoManageAccess />
      </div>
    );
  if (id && error)
    return (
      <div className="page">
        <Breadcrumb items={allergyMenuCrumbs(title)} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={allergyMenuCrumbs(title)} />
      <h1 className="page__title">{id ? `Sửa thực đơn thay thế ${item?.code || ''}` : title}</h1>
      <form onSubmit={submit} noValidate>
        <div className="card wizard-card">
          <div className="card__header">
            <div className="card__title">Nhóm trẻ áp dụng</div>
          </div>
          <div className="card__body td-form-grid">
            <FormField label="Thực đơn mẫu gốc" required error={show('baseMenuId')} className="td-span-all">
              <SearchSelect
                options={menuOptions}
                value={form.baseMenuId}
                onChange={(v) => setForm((f) => ({ ...f, baseMenuId: v, replacements: [] }))}
                placeholder="Chọn thực đơn mẫu..."
                ariaLabel="Thực đơn mẫu gốc"
                disabled={!!id}
              />
            </FormField>
            <FormField label="Tên thực đơn thay thế" required error={show('name')}>
              <input className="input" value={form.name} maxLength={150} onChange={(e) => set('name', e.target.value)} />
            </FormField>
            <FormField label="Loại nhóm" required>
              <select className="select" value={form.groupType} onChange={(e) => set('groupType', e.target.value)}>
                {Object.entries(ALLERGY_GROUP_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Trạng thái" required>
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(RECORD_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </FormField>
            <div className="field td-span-all">
              <span className="field__label" id="td-restrictions">
                Thành phần cần tránh<span className="req">*</span>
              </span>
              <div className="td-allergen-pick" role="group" aria-labelledby="td-restrictions">
                {ALLERGENS.map((a) => {
                  const ctx = allergyRows.find((r) => sameAllergen(r.allergen, a));
                  return (
                    <label key={a}>
                      <input type="checkbox" checked={form.restrictions.includes(a)} onChange={() => toggle(a)} /> {a}
                      {ctx && <span className="text-xs">({ctx.childCount} trẻ)</span>}
                    </label>
                  );
                })}
              </div>
              {show('restrictions') && <span className="field__error">{errors.restrictions}</span>}
            </div>
            <FormField label="Ghi chú" className="td-span-all">
              <input className="input" value={form.note} maxLength={300} onChange={(e) => set('note', e.target.value)} />
            </FormField>
          </div>
        </div>

        {affected.length > 0 && base && (
          <div className="alert alert--info mt-16">
            <ShieldCheck size={18} />
            <div>
              Trẻ thuộc {ageGroupById(base.ageGroupId)?.name} cần thực đơn này:{' '}
              {affected
                .map(
                  (r) =>
                    `${r.allergen} – ${r.classes.map((c) => `${c.className} (${md.campusById(c.campusId)?.code || ''}): ${c.count}`).join(', ')}`,
                )
                .join('; ')}
              .
            </div>
          </div>
        )}

        {base && (
          <div className="card wizard-card mt-16">
            <div className="card__header">
              <div className="card__title">Món thay thế</div>
            </div>
            <div className="card__body">
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>Bữa</th>
                      <th>Món gốc</th>
                      <th>Chứa</th>
                      <th style={{ minWidth: 240 }}>Thay bằng</th>
                      <th style={{ width: 110 }}>Hệ số</th>
                    </tr>
                  </thead>
                  <tbody>
                    {base.meals.flatMap((meal) =>
                      meal.items.map((it) => {
                        const dish = catalog.dishById[it.dishId];
                        const allergens = dish ? dishAllergens(dish, catalog.foodById) : [];
                        const needs = allergens.some((a) => form.restrictions.some((r) => sameAllergen(r, a)));
                        const rep = repOf(meal.session, it.dishId);
                        const value = rep ? rep.replacementDishId || REMOVE : '';
                        return (
                          <tr key={`${meal.session}_${it.dishId}`} className={needs && !rep ? 'td-row--danger' : ''}>
                            <td className="nowrap">{MEAL_SESSION_LABELS[meal.session]}</td>
                            <td>
                              {dish?.name || 'Món đã xóa'}
                              {needs && !rep && <div className="text-xs td-bad">Cần thay</div>}
                            </td>
                            <td>
                              <AllergenChips allergens={allergens} />
                            </td>
                            <td>
                              <SearchSelect
                                options={[
                                  { value: '', label: 'Giữ nguyên món' },
                                  { value: REMOVE, label: 'Bỏ món, không thay' },
                                  ...dishOptions(it.dishId),
                                ]}
                                value={value}
                                onChange={(v) => setRep(meal.session, it.dishId, v)}
                                ariaLabel={`Thay món ${dish?.name || ''}`}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="input"
                                min="0.1"
                                max="3"
                                step="0.1"
                                disabled={!rep?.replacementDishId}
                                value={rep?.portion ?? it.portion}
                                aria-label={`Hệ số khẩu phần món thay ${dish?.name || ''}`}
                                onChange={(e) => setRep(meal.session, it.dishId, value, e.target.value)}
                              />
                            </td>
                          </tr>
                        );
                      }),
                    )}
                  </tbody>
                </table>
              </div>
              {form.restrictions.length > 0 &&
                (conflicts.length ? (
                  <div className="alert alert--danger mt-12" role="alert">
                    <ShieldAlert size={18} />
                    <div>
                      Phát hiện xung đột chế độ ăn. Còn{' '}
                      {conflicts.map((c) => `${c.allergen} trong ${c.dishes.map((d) => d.name).join(', ')}`).join('; ')}. Hãy chọn món thay
                      thế.
                    </div>
                  </div>
                ) : (
                  <div className="alert alert--success mt-12">
                    <ShieldCheck size={18} />
                    <div>Thực đơn thay thế không còn thành phần cần tránh.</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {base && result && (
          <div className="card mt-16">
            <div className="card__header">
              <div className="card__title">Thực đơn sau khi thay và dinh dưỡng</div>
            </div>
            <div className="card__body">
              <MealsView
                meals={effective}
                catalog={catalog}
                changedDishIds={form.replacements.map((r) => r.replacementDishId).filter(Boolean)}
              />
              <div className="mt-16">
                <NutritionTable
                  result={result}
                  ageGroupId={base.ageGroupId}
                  price={priceOn(catalog.mealPrices, base.ageGroupId, todayInput())?.price}
                />
              </div>
            </div>
          </div>
        )}

        <div className="page-actions">
          <button type="button" className="btn" onClick={() => navigate(id ? `/menu/allergy-menus/${id}` : '/menu/allergy-menus')}>
            <ArrowLeft size={16} /> Hủy
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner small /> : <Save size={16} />} Lưu thực đơn thay thế
          </button>
        </div>
      </form>
    </div>
  );
}
