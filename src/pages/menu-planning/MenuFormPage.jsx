import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Bowl, ChevronDown, Copy, Plus, Save, Sparkles, Trash2, X } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  useAllergyContext,
  useAllergyMenus,
  useMenuAccess,
  useMenuCatalog,
  useSampleMenu,
  useSampleMenus,
} from '@/hooks/menu-planning/useMenuPlanning';
import { getAiDraft, saveSampleMenu } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { EditHead } from '@/components/ui/EditHead';
import { FormField } from '@/components/form/FormField';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { AutoChecks } from '@/components/menu-planning/AutoChecks';
import { DishQuickAdd } from '@/components/menu-planning/DishQuickAdd';
import { AiTemplateComposer } from '@/components/menu-planning/AiTemplateComposer';
import { AllergySubstitutes } from '@/components/menu-planning/AllergySubstitutes';
import { dishAllergens, dishTotals, normalizeMeals, sameAllergen } from '@/utils/menu-planning/menuCalculations';
import { checkDayMenu } from '@/utils/menu-planning/menuChecks';
import { validateMenu, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { activeAgeGroups, mealCodesOf, mealsOf } from '@/utils/menu-planning/nutritionSetup';
import { sampleMenuCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import { AGE_GROUPS, ageGroupById } from '@/models/School';
import { AI_LABEL, DISH_TYPE_LABELS, RECORD_STATUS_LABELS, formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const EMPTY = { name: '', ageGroupId: '', note: '', status: 'ACTIVE', meals: [] };
const kcalOf = (t) => Math.round(t.totals.kcal).toLocaleString('vi-VN');

/**
 * Bước 3 luồng dinh dưỡng – trang sửa thực đơn mẫu (bố cục: bữa bên trái, thư viện món bên phải).
 * Dinh dưỡng, chi phí và "Kiểm tra tự động" tính lại ngay; AI soạn mẫu chỉ tạo bản nháp chờ người lưu.
 */
export default function MenuFormPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const access = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog({ live: false });
  const copyOf = params.get('copyOf');
  const { item, loading, error, reload } = useSampleMenu(id || copyOf, { live: false });
  const { items: others } = useSampleMenus({});
  const [form, setForm] = useState({ ...EMPTY, ageGroupId: params.get('ageGroupId') || '' });
  const [aiDraft, setAiDraft] = useState(null);
  const [beforeAi, setBeforeAi] = useState(null);
  const [aiOpen, setAiOpen] = useState(params.get('ai') === '1');
  const [target, setTarget] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const { rows: allergyRows } = useAllergyContext(form.ageGroupId);
  const { items: substitutes } = useAllergyMenus({ baseMenuId: id || '__none__' });
  const aiDraftId = params.get('aiDraftId');

  useEffect(() => {
    if (!item) return;
    setForm({
      name: copyOf && !id ? `${item.name} (bản sao)` : item.name,
      ageGroupId: item.ageGroupId,
      note: item.note,
      status: item.status,
      meals: item.meals,
    });
  }, [item, copyOf, id]);

  // Mở từ màn gợi ý AI cũ (?aiDraftId=) vẫn nạp bản nháp vào trang này
  useEffect(() => {
    if (id || !aiDraftId) return undefined;
    let ignore = false; // đổi bản nháp/rời trang ⇒ bỏ kết quả cũ
    getAiDraft(aiDraftId, user)
      .then((d) => {
        if (ignore) return;
        setAiDraft(d);
        setForm((f) => ({ ...f, ageGroupId: d.ageGroupId, meals: d.meals, name: f.name || 'Thực đơn từ gợi ý AI' }));
      })
      .catch((err) => !ignore && toast.error(err, 'Không mở được bản nháp AI'));
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiDraftId, id]);

  const mealList = form.ageGroupId ? mealsOf(catalog.nutritionSetups, form.ageGroupId) : [];
  const codes = mealList.map((m) => m.code);
  const meals = form.ageGroupId ? normalizeMeals(form.meals, codes) : [];
  const activeTarget = codes.includes(target) ? target : codes[0] || '';
  const errors = {
    ...validateMenu({ ...form, meals, id }, others, form.ageGroupId ? mealList : undefined),
    ...serverErrors,
  };
  const show = (k) => (submitted ? errors[k] : undefined);
  const today = todayInput();
  const check = form.ageGroupId
    ? checkDayMenu({ meals, ageGroupId: form.ageGroupId, catalog, date: today, allergyRows, allergyMenus: substitutes })
    : null;
  const groupName = ageGroupById(form.ageGroupId)?.shortName;
  const title = id ? 'Sửa thực đơn mẫu' : 'Thêm thực đơn mẫu';

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors({});
  };
  const setMealItems = (session, fn) =>
    set(
      'meals',
      meals.map((m) => (m.session === session ? { ...m, items: fn(m.items) } : m)),
    );
  const addDish = (dishId) => {
    if (!activeTarget) return;
    setMealItems(activeTarget, (items) => [...items, { dishId, portion: 1 }]);
  };
  const changeAgeGroup = (ag) => {
    setServerErrors({});
    setForm((f) => ({ ...f, ageGroupId: ag, meals: ag ? normalizeMeals(f.meals, mealCodesOf(catalog.nutritionSetups, ag)) : f.meals }));
  };
  const applyDraft = (d) => {
    setBeforeAi(form.meals);
    setAiDraft(d);
    setForm((f) => ({ ...f, meals: d.meals, name: f.name || 'Thực đơn do AI soạn' }));
  };
  const openAi = () => {
    if (!form.ageGroupId) toast.error('Chọn nhóm tuổi trước khi nhờ AI soạn.', 'Chưa soạn được');
    else setAiOpen(true);
  };
  const discardDraft = () => {
    setForm((f) => ({ ...f, meals: beforeAi || [] }));
    setAiDraft(null);
    setBeforeAi(null);
  };

  const submit = async (e) => {
    e?.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors)) {
      toast.error('Hãy kiểm tra các ô được đánh dấu.', 'Chưa lưu được');
      return;
    }
    setBusy(true);
    try {
      await saveSampleMenu(id, { ...form, meals, aiDraftId: aiDraft?.id }, user);
      toast.success('Lưu thay đổi thành công.');
      navigate('/menu/menus');
    } catch (err) {
      if (err.details) setServerErrors(err.details);
      toast.error(err, 'Không lưu được thay đổi');
    } finally {
      setBusy(false);
    }
  };

  if (access.loading || loading || catLoading) return <LoadingState />;
  if (!access.canManage)
    return (
      <div className="page">
        <Breadcrumb items={sampleMenuCrumbs(title)} />
        <h1 className="page__title">{title}</h1>
        <NoManageAccess />
      </div>
    );
  if ((id || copyOf) && error)
    return (
      <div className="page">
        <Breadcrumb items={sampleMenuCrumbs(title)} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  // Món chứa chất mà nhóm có trẻ dị ứng: hiện số trẻ ở dòng phụ ngay dưới món
  const allergyNote = (dish, session) =>
    dishAllergens(dish, catalog.foodById)
      .map((a) => {
        // Món thay trong suất thay thế đã lưu (nếu có) cho đúng bữa và món này
        const r = substitutes
          .filter((s) => s.restrictions.some((x) => sameAllergen(x, a)))
          .flatMap((s) => s.replacements)
          .find((x) => x.session === session && x.originalDishId === dish.id);
        const swap = r ? (r.replacementDishId ? catalog.dishById[r.replacementDishId]?.name : 'bỏ món') : null;
        return { a, kids: allergyRows.find((x) => sameAllergen(x.allergen, a))?.childCount, swap };
      })
      .filter((x) => x.kids);
  const groupOptions = AGE_GROUPS.filter((g) => g.id === form.ageGroupId || activeAgeGroups(catalog.nutritionSetups).includes(g));

  return (
    <div className="page">
      <Breadcrumb items={sampleMenuCrumbs(form.name.trim() || title)} />
      <form onSubmit={submit} noValidate>
        <EditHead
          backTo="/menu/menus"
          backLabel="Quay lại Thực đơn mẫu"
          title={form.name.trim() || title}
          meta={groupName ? `Nhóm tuổi: ${groupName}` : null}
          actions={
            <>
              <Link className="btn" to="/menu/menus">
                <X size={16} /> Hủy
              </Link>
              <button type="button" className="btn btn--outline-primary" onClick={openAi}>
                <Sparkles size={16} /> AI soạn mẫu
              </button>
              {id && (
                <Link className="btn" to={`/menu/menus/new?copyOf=${id}`}>
                  <Copy size={16} /> Sao chép
                </Link>
              )}
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy ? <Spinner small /> : <Save size={16} />} Lưu
              </button>
            </>
          }
        />

        <section className="card">
          <div className="card__body td-form-grid">
            <FormField label="Tên thực đơn" required error={show('name')}>
              <input className="input" value={form.name} maxLength={100} onChange={(e) => set('name', e.target.value)} />
            </FormField>
            <FormField label="Nhóm tuổi" required error={show('ageGroupId')}>
              <select className="select" value={form.ageGroupId} onChange={(e) => changeAgeGroup(e.target.value)} disabled={!!id}>
                <option value="">Chọn nhóm tuổi</option>
                {groupOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
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
          </div>
          <details className="td-more-info">
            <summary className="link-btn">
              <ChevronDown size={16} /> Ghi chú
            </summary>
            <div className="td-form-grid">
              <FormField label="Ghi chú" className="td-span-all">
                <textarea className="textarea" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
              </FormField>
            </div>
          </details>
        </section>

        {aiDraft && (
          <div className="alert alert--purple">
            <Sparkles size={18} />
            <div className="td-grow">
              <b>{AI_LABEL}.</b> Món bên dưới do AI chọn; bạn sửa nếu cần rồi bấm Lưu.
            </div>
            <button type="button" className="btn btn--sm btn--ghost" onClick={discardDraft}>
              Hoàn tác
            </button>
          </div>
        )}
        {form.ageGroupId && (
          <AiTemplateComposer
            open={aiOpen}
            onClose={() => setAiOpen(false)}
            ageGroupId={form.ageGroupId}
            groupName={groupName}
            mealList={mealList}
            catalog={catalog}
            date={today}
            price={check?.price}
            allergyRows={allergyRows}
            hasDishes={meals.some((m) => m.items.length)}
            onUse={applyDraft}
          />
        )}

        {!form.ageGroupId ? (
          <section className="card">
            <p className="muted td-card-note td-flat">Chọn nhóm tuổi để soạn các bữa.</p>
          </section>
        ) : (
          <div className="td-split-aside">
            <div className="td-aside-stack">
              {mealList.map((m) => {
                const items = meals.find((x) => x.session === m.code)?.items || [];
                const rows = items.map((it) => ({ it, dish: catalog.dishById[it.dishId] }));
                const mealCost = rows.reduce(
                  (s, r) => s + (r.dish ? dishTotals(r.dish, catalog.foodById, r.it.portion, form.ageGroupId).cost : 0),
                  0,
                );
                return (
                  <section key={m.code} className={`card ${activeTarget === m.code ? 'td-meal-card--target' : ''}`}>
                    <div className="card__header">
                      <h2 className="card__title">
                        <Bowl size={18} /> {m.name}
                      </h2>
                      <div className="row td-card-tools">
                        <span className="text-sm muted">Chi phí bữa {formatMoney(mealCost)}</span>
                        <button type="button" className="btn btn--sm" onClick={() => setTarget(m.code)}>
                          <Plus size={15} /> Thêm món ăn
                        </button>
                      </div>
                    </div>
                    {show(`meal_${m.code}`) && <p className="field__error td-card-error">{show(`meal_${m.code}`)}</p>}
                    <div className="table-wrap">
                      <table className="table table--grid td-meal-table">
                        <thead>
                          <tr>
                            <th>Món ăn</th>
                            <th>Loại</th>
                            <th className="num">Kcal</th>
                            <th className="money">Thành tiền</th>
                            <th className="td-num-col" aria-label="Bỏ món" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.length ? (
                            rows.map(({ it, dish }, i) => {
                              const t = dish ? dishTotals(dish, catalog.foodById, it.portion, form.ageGroupId) : null;
                              const notes = dish ? allergyNote(dish, m.code) : [];
                              return (
                                <Fragment key={`${it.dishId}-${i}`}>
                                  <tr>
                                    <td>
                                      <span className="fw-600">{dish?.name || 'Món đã xóa'}</span>
                                    </td>
                                    <td className="text-sm">{DISH_TYPE_LABELS[dish?.type] || '—'}</td>
                                    <td className="num nowrap">
                                      {t ? t.noQuantity ? <span className="td-warn">Thiếu</span> : kcalOf(t) : '—'}
                                    </td>
                                    <td className="money nowrap">{t ? formatMoney(t.cost) : '—'}</td>
                                    <td className="td-num-col">
                                      <button
                                        type="button"
                                        className="icon-btn"
                                        aria-label={`Bỏ ${dish?.name || 'món'}`}
                                        onClick={() => setMealItems(m.code, (list) => list.filter((_, j) => j !== i))}
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                  {notes.length > 0 && (
                                    <tr className="td-meal-table__allergy">
                                      <td colSpan={5}>
                                        {notes.map((x) => (
                                          <span key={x.a} className={`td-dish-allergy ${x.swap ? '' : 'td-dish-allergy--missing'}`}>
                                            <AlertTriangle size={12} aria-hidden="true" /> {x.kids} trẻ dị ứng {x.a.toLowerCase()}
                                            {x.swap ? ` → ${x.swap}` : ' · chưa có suất thay thế'}
                                          </span>
                                        ))}
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={5} className="muted text-sm">
                                Chưa có món. Chọn món ở "Thêm nhanh từ danh mục".
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
              {check && <AutoChecks items={check.checks} numbers={check.numbers} />}
              <AllergySubstitutes menu={id ? item : null} catalog={catalog} allergyRows={allergyRows} canManage={access.canManage} />
            </div>
            <DishQuickAdd
              catalog={catalog}
              ageGroupId={form.ageGroupId}
              meals={meals}
              mealOptions={mealList}
              target={activeTarget}
              onTarget={setTarget}
              onAdd={addDish}
            />
          </div>
        )}
      </form>
    </div>
  );
}
