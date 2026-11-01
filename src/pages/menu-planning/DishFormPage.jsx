import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Copy, Plus, Save, Trash2, X } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDish, useDishes, useMenuAccess, useMenuCatalog } from '@/hooks/menu-planning/useMenuPlanning';
import { saveDish } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { EditHead } from '@/components/ui/EditHead';
import { AutoChecks } from '@/components/menu-planning/AutoChecks';
import { dishAllergens, dishTotals, hasNutrition } from '@/utils/menu-planning/menuCalculations';
import { activeAgeGroups, ageAbbr } from '@/utils/menu-planning/nutritionSetup';
import { validateDish, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { copyPortions, countReplacedCells, duplicateDishForm, recipeRow } from '@/utils/menu-planning/recipeCopy';
import { dishCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { AGE_GROUPS } from '@/models/School';
import {
  DISH_STATUS,
  DISH_TYPE_LABELS,
  FOOD_GROUP_LABELS,
  RECORD_STATUS,
  RECORD_STATUS_LABELS,
  formatMoney,
} from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const emptyRow = () => ({ isNew: true, foodId: '', portions: Object.fromEntries(AGE_GROUPS.map((a) => [a.id, ''])) });
const AGE_IDS = AGE_GROUPS.map((a) => a.id);
const EMPTY = { name: '', type: '', description: '', status: DISH_STATUS.DRAFT, ingredients: [emptyRow()] };
const toRow = (ing) => recipeRow(ing, AGE_IDS);
const g = (v) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/** Bước 2 luồng dinh dưỡng – trang sửa món: định lượng từng nhóm tuổi, cột phải là dinh dưỡng 1 suất và kiểm tra tự động. */
export default function DishFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const access = useMenuAccess();
  const { catalog, loading: catLoading } = useMenuCatalog({ live: false });
  const { item, loading, error, reload } = useDish(id, { live: false });
  // "?from=<id>": nhân bản món (BA 03) — form món mới điền sẵn từ món gốc, chỉ tạo khi bấm lưu
  const [params] = useSearchParams();
  const fromId = id ? null : params.get('from');
  const source = useDish(fromId, { live: false });
  const { items: others } = useDishes({});
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyTo, setCopyTo] = useState('');
  const [copied, setCopied] = useState([]);
  const [pendingCopy, setPendingCopy] = useState(null);
  const [statusError, setStatusError] = useState('');

  useEffect(() => {
    if (source.item) setForm(duplicateDishForm(source.item, AGE_IDS, DISH_STATUS.DRAFT));
  }, [source.item]);

  useEffect(() => {
    if (item)
      setForm({
        name: item.name,
        type: item.type,
        description: item.description,
        status: item.status,
        ingredients: item.ingredients.map(toRow),
      });
    else if (!id && !fromId) setForm(EMPTY);
  }, [item, id, fromId]);

  const groups = activeAgeGroups(catalog.nutritionSetups);
  const foodOptions = useMemo(
    () =>
      catalog.foods
        .filter((f) => f.status === RECORD_STATUS.ACTIVE || form.ingredients.some((r) => r.foodId === f.id))
        .map((f) => ({ value: f.id, label: f.name, searchText: `${f.name} ${FOOD_GROUP_LABELS[f.group]}` })),
    [catalog.foods, form.ingredients],
  );

  const title = id ? 'Sửa món ăn' : fromId ? 'Nhân bản món ăn' : 'Thêm món ăn';
  // Món mới hoặc món Nháp: chọn Lưu nháp / Lưu và dùng cho thực đơn (user chốt 20/10/2026)
  const draftMode = !id || item?.status === DISH_STATUS.DRAFT;
  const requireGroups = groups.map((a) => ({ id: a.id, name: ageAbbr(a.id) }));
  const errors = { ...validateDish({ ...form, id }, others), ...serverErrors };
  const show = (k) => (submitted || touched[k] ? errors[k] : undefined);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors({});
    setStatusError('');
  };
  const applyCopy = (from, to) => {
    set('ingredients', copyPortions(form.ingredients, from, to));
    setCopied((list) => [...new Set([...list, to])]);
    setPendingCopy(null);
  };
  const startCopy = () => {
    if (!copyFrom || !copyTo || copyFrom === copyTo) return;
    const count = countReplacedCells(form.ingredients, copyFrom, copyTo);
    // Nhóm đích đã có số ⇒ hỏi trước, không tự ghi đè (BA 03)
    if (count) setPendingCopy({ from: copyFrom, to: copyTo, count });
    else applyCopy(copyFrom, copyTo);
  };
  const setRow = (i, patch) =>
    set(
      'ingredients',
      form.ingredients.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    );
  const setQty = (i, ag, v) => setRow(i, { portions: { ...form.ingredients[i].portions, [ag]: v } });
  const preview = { name: form.name, ingredients: form.ingredients.filter((r) => r.foodId) };

  const usedFoods = preview.ingredients.map((r) => catalog.foodById[r.foodId]).filter(Boolean);
  const noQtyGroups = groups.filter((a) => dishTotals(preview, catalog.foodById, 1, a.id).noQuantity);
  const noNutrition = usedFoods.filter((f) => !hasNutrition(f)).map((f) => f.name);
  const noPrice = usedFoods.filter((f) => !f.unitPrice).map((f) => f.name);
  const allergens = dishAllergens(preview, catalog.foodById);
  const appliedGroups = preview.ingredients.length ? groups.filter((a) => !noQtyGroups.includes(a)) : [];
  const g1 = (v) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  const portionItems = groups.map((a) => {
    const t = dishTotals(preview, catalog.foodById, 1, a.id);
    return t.noQuantity || !preview.ingredients.length
      ? { tone: 'bad', text: `${ageAbbr(a.id)}: chưa có định lượng` }
      : {
          tone: 'ok',
          text: `${ageAbbr(a.id)}: ${g1(t.totals.kcal)} kcal · đạm ${g1(t.totals.protein)} g · béo ${g1(t.totals.lipid)} g · bột ${g1(t.totals.glucid)} g · ${formatMoney(t.cost)}`,
        };
  });
  const checks = [
    ...noQtyGroups.map((a) => ({ tone: 'bad', text: `Cột ${ageAbbr(a.id)} chưa có định lượng: món chưa dùng được cho ${ageAbbr(a.id)}.` })),
    ...(noNutrition.length ? [{ tone: 'warn', text: `Thiếu số liệu dinh dưỡng: ${noNutrition.join(', ')}.` }] : []),
    ...(noPrice.length ? [{ tone: 'warn', text: `Chưa có đơn giá: ${noPrice.join(', ')}.` }] : []),
  ];
  if (!checks.length && preview.ingredients.length)
    checks.push({ tone: 'ok', text: `Đủ định lượng và số liệu cho ${groups.length} nhóm tuổi.` });

  const submit = async (e, again = false, status = form.status) => {
    e?.preventDefault();
    setSubmitted(true);
    if (hasErrors(Object.fromEntries(Object.entries(errors).filter(([, v]) => v)))) return;
    const activating = status === DISH_STATUS.ACTIVE && draftMode;
    const statusCheck = activating ? validateDish({ ...form, status, id }, others, { requireGroups }).status : '';
    setStatusError(statusCheck || '');
    if (statusCheck) return;
    setBusy(true);
    try {
      await saveDish(id, { ...form, status }, user);
      toast.success('Lưu thay đổi thành công.');
      if (again) {
        setForm(EMPTY);
        setSubmitted(false);
        setTouched({});
        navigate('/menu/dishes/new');
      } else navigate('/menu/dishes');
    } catch (err) {
      if (err.details) setServerErrors(err.details);
      if (err.details?.status) setStatusError(err.details.status);
      toast.error(err, 'Không lưu được thay đổi');
    } finally {
      setBusy(false);
    }
  };

  if (access.loading || loading || source.loading || catLoading) return <LoadingState />;
  if (!access.canManage)
    return (
      <div className="page">
        <Breadcrumb items={dishCrumbs(title)} />
        <h1 className="page__title">{title}</h1>
        <NoManageAccess />
      </div>
    );
  if ((id && error) || (fromId && source.error))
    return (
      <div className="page">
        <Breadcrumb items={dishCrumbs(title)} />
        <ErrorState error={error || source.error} onRetry={error ? reload : source.reload} />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={dishCrumbs(title)} />
      <form onSubmit={submit} noValidate>
        <EditHead
          backTo="/menu/dishes"
          backLabel="Quay lại Món ăn"
          title={form.name.trim() || title}
          meta={
            [DISH_TYPE_LABELS[form.type], allergens.length ? `có ${allergens.join(', ').toLowerCase()}` : ''].filter(Boolean).join(' · ') ||
            null
          }
          actions={
            draftMode ? (
              <>
                <Link className="btn" to="/menu/dishes">
                  <X size={16} /> Hủy
                </Link>
                <button type="button" className="btn" disabled={busy} onClick={() => submit(null, false, DISH_STATUS.DRAFT)}>
                  <Save size={16} /> Lưu nháp
                </button>
                <button type="button" className="btn btn--primary" disabled={busy} onClick={() => submit(null, false, DISH_STATUS.ACTIVE)}>
                  {busy ? <Spinner small /> : <Save size={16} />} Lưu và dùng cho thực đơn
                </button>
              </>
            ) : (
              <>
                <Link className="btn" to="/menu/dishes">
                  <X size={16} /> Hủy
                </Link>
                <button type="button" className="btn" disabled={busy} onClick={() => submit(null, true)}>
                  <Save size={16} /> Lưu & thêm mới
                </button>
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  {busy ? <Spinner small /> : <Save size={16} />} Lưu
                </button>
              </>
            )
          }
        />

        {statusError && (
          <div className="alert alert--danger mb-16" role="alert">
            <AlertTriangle size={18} />
            <div>{statusError}</div>
          </div>
        )}
        <section className="card">
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
            <div className="field">
              <span className="field__label">
                Nhóm trẻ áp dụng<span className="req">*</span>
              </span>
              <div className="td-tags" title="Tính từ các cột đã nhập đủ định lượng">
                {appliedGroups.length ? (
                  appliedGroups.map((g) => (
                    <span key={g.id} className="chip chip--blue">
                      {ageAbbr(g.id)}
                    </span>
                  ))
                ) : (
                  <span className="muted text-sm">Chưa đủ định lượng nhóm nào</span>
                )}
              </div>
            </div>
          </div>
          {/* Trạng thái và mô tả ít khi sửa: thu gọn để thẻ thông tin gọn như wireframe */}
          <details className="td-more-info">
            <summary className="link-btn">
              <ChevronDown size={16} /> Mô tả, trạng thái
            </summary>
            <div className="td-form-grid">
              {draftMode ? (
                <FormField label="Trạng thái" hint="Chọn nút lưu: Lưu nháp hoặc Lưu và dùng cho thực đơn">
                  <input className="input" value="Nháp – chưa dùng được cho thực đơn" readOnly disabled />
                </FormField>
              ) : (
                <FormField label="Trạng thái" required>
                  <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                    {Object.entries(RECORD_STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </FormField>
              )}
              <FormField label="Mô tả, cách chế biến" className="td-span-2">
                <textarea className="textarea" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
              </FormField>
            </div>
          </details>
        </section>

        <div className="td-split-aside">
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Thành phần và định lượng một trẻ</h2>
              <span className="text-sm muted">Để trống ô của nhóm chưa dùng món này</span>
            </div>
            {groups.length > 1 && (
              <div className="filter-bar td-recipe-copy">
                <span className="text-sm">Chép định lượng từ</span>
                <select
                  className="select"
                  value={copyFrom}
                  onChange={(e) => setCopyFrom(e.target.value)}
                  aria-label="Chép định lượng từ nhóm"
                >
                  <option value="">Chọn nhóm</option>
                  {groups.map((a) => (
                    <option key={a.id} value={a.id}>
                      {ageAbbr(a.id)}
                    </option>
                  ))}
                </select>
                <span className="text-sm">sang</span>
                <select
                  className="select"
                  value={copyTo}
                  onChange={(e) => setCopyTo(e.target.value)}
                  aria-label="Chép định lượng sang nhóm"
                >
                  <option value="">Chọn nhóm</option>
                  {groups
                    .filter((a) => a.id !== copyFrom)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {ageAbbr(a.id)}
                      </option>
                    ))}
                </select>
                <button type="button" className="btn btn--sm" onClick={startCopy} disabled={!copyFrom || !copyTo || copyFrom === copyTo}>
                  <Copy size={15} /> Chép
                </button>
              </div>
            )}
            {copied.length > 0 && (
              <div className="alert alert--warning td-recipe-copied">
                <AlertTriangle size={18} />
                <div>Vừa chép định lượng cho {copied.map(ageAbbr).join(', ')} — kiểm tra lại từng ô trước khi lưu.</div>
              </div>
            )}
            <div className="table-wrap td-recipe-wrap">
              <table className="table table--grid table--compact td-recipe">
                <thead>
                  <tr>
                    <th className="num cell--fixed">#</th>
                    <th>
                      Thành phần <span className="req">*</span>
                    </th>
                    <th className="cell--fixed">ĐVT</th>
                    {groups.map((a) => (
                      <th key={a.id} className="center">
                        {ageAbbr(a.id)}
                        {copied.includes(a.id) && (
                          <span className="chip chip--orange td-copied-chip" title="Vừa chép — kiểm tra lại">
                            Vừa chép
                          </span>
                        )}
                      </th>
                    ))}
                    <th className="center">
                      <span className="sr-only">Xóa</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {form.ingredients.map((r, i) => {
                    const food = catalog.foodById[r.foodId];
                    const qtyErr = groups.map((a) => errors[`ing_${i}_${a.id}`]).find(Boolean);
                    const err = submitted ? errors[`ing_${i}`] || (qtyErr && `Định lượng ${qtyErr.toLowerCase()}`) : undefined;
                    return (
                      <tr key={i}>
                        <td className="num muted cell--fixed">{i + 1}</td>
                        <td className="td-recipe__food">
                          {r.isNew ? (
                            <SearchSelect
                              options={foodOptions.filter(
                                (o) => o.value === r.foodId || !form.ingredients.some((x) => x.foodId === o.value),
                              )}
                              value={r.foodId}
                              onChange={(v) => setRow(i, { foodId: v })}
                              placeholder="Chọn thực phẩm..."
                              ariaLabel={`Thực phẩm ${i + 1}`}
                              error={!!err}
                            />
                          ) : (
                            <b>{food?.name || 'Thực phẩm đã xóa'}</b>
                          )}
                          {err && <span className="field__error">{err}</span>}
                        </td>
                        <td className="muted cell--fixed">{food?.unit || 'g'}</td>
                        {groups.map((a) => {
                          const v = r.portions[a.id];
                          const bad = submitted && errors[`ing_${i}_${a.id}`];
                          return (
                            <td key={a.id} className="center">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                className={`input td-qty ${v === '' ? 'td-qty--empty' : ''} ${bad ? 'is-invalid' : ''}`}
                                value={v}
                                placeholder="Nhập"
                                title={bad || undefined}
                                onChange={(e) => setQty(i, a.id, e.target.value)}
                                aria-label={`Định lượng ${food?.name || `thực phẩm ${i + 1}`} cho ${a.name}`}
                              />
                            </td>
                          );
                        })}
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
                <tfoot>
                  <tr>
                    <td className="cell--fixed" />
                    <td colSpan={2} className="cell--fixed">
                      Năng lượng một suất
                    </td>
                    {groups.map((a) => {
                      const t = dishTotals(preview, catalog.foodById, 1, a.id);
                      return (
                        <td key={a.id} className="center nowrap cell--fixed">
                          {t.noQuantity ? <span className="td-warn">Thiếu</span> : `${g(t.totals.kcal)} kcal`}
                        </td>
                      );
                    })}
                    <td className="cell--fixed" />
                  </tr>
                </tfoot>
              </table>
            </div>
            {submitted && errors.ingredients && <span className="field__error td-card-error">{errors.ingredients}</span>}
            <div className="td-add-meal">
              <button type="button" className="link-btn" onClick={() => set('ingredients', [...form.ingredients, emptyRow()])}>
                <Plus size={16} /> Thêm thành phần
              </button>
            </div>
          </section>

          <div className="td-aside-stack">
            <AutoChecks title="Dinh dưỡng 1 suất" items={portionItems} />
            {checks.length > 0 && <AutoChecks items={checks} />}
          </div>
        </div>
      </form>
      <ConfirmationModal
        open={!!pendingCopy}
        title="Chép định lượng"
        message={
          pendingCopy &&
          `Thay ${pendingCopy.count} ô đã nhập của nhóm ${ageAbbr(pendingCopy.to)} bằng định lượng của nhóm ${ageAbbr(pendingCopy.from)}?`
        }
        confirmLabel="Thay và chép"
        onConfirm={() => applyCopy(pendingCopy.from, pendingCopy.to)}
        onClose={() => setPendingCopy(null)}
      />
    </div>
  );
}
