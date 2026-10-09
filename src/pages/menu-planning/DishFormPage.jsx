import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Sparkles, Trash2 } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDish, useDishes, useMenuAccess, useMenuCatalog } from '@/hooks/menu-planning/useMenuPlanning';
import { saveDish } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { AllergenChips, NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { DishPortionTable } from '@/components/menu-planning/DishPortionTable';
import { dishAllergens, dishTotals } from '@/utils/menu-planning/menuCalculations';
import { validateDish, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { dishCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { DISH_TYPE_LABELS, FOOD_GROUP_LABELS, RECORD_STATUS, RECORD_STATUS_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const EMPTY = { name: '', type: '', description: '', status: 'ACTIVE', ingredients: [{ foodId: '', quantity: '' }] };

/** Screen #73 – the Vice Principal (shared services) creates or edits a dish and its recipe quantities (UC 6.5). */
export default function DishFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const access = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog({ live: false });
  const { item, loading, error, reload } = useDish(id, { live: false });
  const { items: others } = useDishes({});
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item)
      setForm({ name: item.name, type: item.type, description: item.description, status: item.status, ingredients: item.ingredients });
  }, [item]);

  const foodOptions = useMemo(
    () =>
      catalog.foods
        .filter((f) => f.status === RECORD_STATUS.ACTIVE || form.ingredients.some((r) => r.foodId === f.id))
        .map((f) => ({ value: f.id, label: f.name, searchText: `${f.name} ${FOOD_GROUP_LABELS[f.group]}` })),
    [catalog.foods, form.ingredients],
  );

  const title = id ? 'Sửa món ăn' : 'Thêm món ăn';
  const errors = { ...validateDish({ ...form, id }, others), ...serverErrors };
  const show = (k) => (submitted || touched[k] ? errors[k] : undefined);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors({});
  };
  const setRow = (i, patch) =>
    set(
      'ingredients',
      form.ingredients.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    );
  const preview = {
    ingredients: form.ingredients.filter((r) => r.foodId).map((r) => ({ foodId: r.foodId, quantity: Number(r.quantity) || 0 })),
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors(Object.fromEntries(Object.entries(errors).filter(([, v]) => v)))) return;
    setBusy(true);
    try {
      const saved = await saveDish(id, form, user);
      toast.success('Lưu thay đổi thành công.');
      navigate(`/menu/dishes/${saved.id}`);
    } catch (err) {
      if (err.details) setServerErrors(err.details);
      toast.error(err.message, 'Không lưu được thay đổi');
    } finally {
      setBusy(false);
    }
  };

  if (access.loading || loading || catLoading) return <LoadingState />;
  if (!access.canManage)
    return (
      <div className="page">
        <Breadcrumb items={dishCrumbs(title)} />
        <h1 className="page__title">{title}</h1>
        <NoManageAccess />
      </div>
    );
  if (id && error)
    return (
      <div className="page">
        <Breadcrumb items={dishCrumbs(title)} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={dishCrumbs(title)} />
      <div className="page__head">
        <h1 className="page__title">{id ? `Sửa món ${item?.code || ''}` : title}</h1>
        <Link className="btn btn--outline-primary" to="/menu/ai-suggestion?kind=DAILY">
          <Sparkles size={16} /> Gợi ý kết hợp món bằng AI
        </Link>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="card wizard-card">
          <div className="card__header">
            <div className="card__title">Thông tin món</div>
          </div>
          <div className="card__body td-form-grid">
            <FormField label="Tên món" required error={show('name')}>
              <input
                className="input"
                value={form.name}
                maxLength={100}
                onChange={(e) => set('name', e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              />
            </FormField>
            <FormField label="Loại món" required error={show('type')}>
              <select
                className="select"
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, type: true }))}
              >
                <option value="">Chọn loại món</option>
                {Object.entries(DISH_TYPE_LABELS).map(([k, v]) => (
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
            <FormField label="Mô tả, cách chế biến" className="td-span-all">
              <textarea className="textarea" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="card wizard-card mt-16">
          <div className="card__header">
            <div className="card__title">Thực phẩm và định lượng cho một khẩu phần chuẩn</div>
          </div>
          <div className="card__body">
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th style={{ minWidth: 240 }}>
                      Thực phẩm <span className="req">*</span>
                    </th>
                    <th style={{ width: 140 }}>
                      Định lượng <span className="req">*</span>
                    </th>
                    <th className="right">Năng lượng</th>
                    <th>Chứa</th>
                    <th className="center" style={{ width: 56 }}>
                      <span className="sr-only">Xóa</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {form.ingredients.map((r, i) => {
                    const food = catalog.foodById[r.foodId];
                    const kcal = food
                      ? dishTotals({ ingredients: [{ foodId: r.foodId, quantity: Number(r.quantity) || 0 }] }, catalog.foodById)
                      : null;
                    const err = submitted ? errors[`ing_${i}`] : undefined;
                    return (
                      <tr key={i}>
                        <td>
                          <SearchSelect
                            options={foodOptions.filter((o) => o.value === r.foodId || !form.ingredients.some((x) => x.foodId === o.value))}
                            value={r.foodId}
                            onChange={(v) => setRow(i, { foodId: v })}
                            placeholder="Chọn thực phẩm..."
                            ariaLabel={`Thực phẩm ${i + 1}`}
                            error={!!err}
                          />
                          {err && <span className="field__error">{err}</span>}
                        </td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              className="input"
                              value={r.quantity}
                              onChange={(e) => setRow(i, { quantity: e.target.value })}
                              aria-label={`Định lượng thực phẩm ${i + 1}`}
                            />
                            <span className="muted">{food?.unit || 'g'}</span>
                          </div>
                        </td>
                        <td className="right nowrap">
                          {kcal ? (
                            kcal.missing.length ? (
                              <span className="td-warn text-sm">Thiếu số liệu</span>
                            ) : (
                              `${kcal.totals.kcal.toLocaleString('vi-VN')} kcal`
                            )
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{food ? <AllergenChips allergens={food.allergens} /> : '—'}</td>
                        <td className="center">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`Bỏ thực phẩm ${food?.name || i + 1}`}
                            title="Bỏ thực phẩm"
                            onClick={() =>
                              set(
                                'ingredients',
                                form.ingredients.filter((_, j) => j !== i),
                              )
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {submitted && errors.ingredients && <span className="field__error">{errors.ingredients}</span>}
            <button
              type="button"
              className="btn btn--sm btn--ghost mt-8"
              onClick={() => set('ingredients', [...form.ingredients, { foodId: '', quantity: '' }])}
            >
              <Plus size={15} /> Thêm thực phẩm
            </button>
          </div>
        </div>

        <div className="card mt-16">
          <div className="card__header">
            <div className="card__title">Dinh dưỡng và chi phí (tự tính)</div>
            <AllergenChips allergens={dishAllergens(preview, catalog.foodById)} empty="Không chứa chất gây dị ứng đã khai báo" />
          </div>
          <div className="card__body">
            <DishPortionTable dish={preview} foodById={catalog.foodById} />
          </div>
        </div>

        <div className="page-actions">
          <button type="button" className="btn" onClick={() => navigate(id ? `/menu/dishes/${id}` : '/menu/dishes')}>
            <ArrowLeft size={16} /> Hủy
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner small /> : <Save size={16} />} Lưu món ăn
          </button>
        </div>
      </form>
    </div>
  );
}
