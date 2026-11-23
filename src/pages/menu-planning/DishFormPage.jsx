import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Copy, Plus, Save, Trash2, X } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useDish, useDishes, useCatalogAccess, useCatalogLookups } from '@/hooks/menu-planning/useMenuPlanning';
import { catalogUsesApi, saveDish } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { LeaveConfirmModal } from '@/components/ui/LeaveConfirmModal';
import { useLeaveGuard } from '@/hooks/useLeaveGuard';
import { NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { EditHead } from '@/components/ui/EditHead';
import { AutoChecks } from '@/components/menu-planning/AutoChecks';
import { DishPortionTable } from '@/components/menu-planning/DishPortionTable';
import { dishAllergens, dishTotals, hasNutrition, hasOrigin, purchaseQty } from '@/utils/menu-planning/menuCalculations';
import { activeAgeGroups, ageAbbr } from '@/utils/menu-planning/nutritionSetup';
import { validateDish, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { copyPortions, countReplacedCells, duplicateDishForm, recipeRow } from '@/utils/menu-planning/recipeCopy';
import { dishCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { AGE_GROUPS } from '@/models/School';
import { DISH_STATUS, DISH_TYPE_LABELS, FOOD_GROUP_LABELS, RECORD_STATUS } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';
import { Button, Checkbox, SelectField, TextField } from '@/components';

const emptyRow = () => ({ isNew: true, foodId: '', portions: Object.fromEntries(AGE_GROUPS.map((a) => [a.id, ''])) });
const AGE_IDS = AGE_GROUPS.map((a) => a.id);
// BE chưa có trạng thái Nháp của món ⇒ khi danh mục dùng BE, món mới lưu là Đang sử dụng / Ngừng sử dụng
const HAS_DRAFT = !catalogUsesApi();
const NEW_STATUS = HAS_DRAFT ? DISH_STATUS.DRAFT : DISH_STATUS.ACTIVE;
const EMPTY = { name: '', type: '', description: '', status: NEW_STATUS, ageGroupIds: [], ingredients: [emptyRow()] };
const g = (v) => v.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

/** Bước 2 luồng dinh dưỡng – trang sửa món: định lượng từng nhóm tuổi, cột phải là dinh dưỡng 1 suất và kiểm tra tự động. */
export default function DishFormPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const access = useCatalogAccess();
  const { catalog, loading: catLoading } = useCatalogLookups({ live: false });
  const { item, loading, error, reload } = useDish(id, { live: false });
  // "?from=<id>": nhân bản món (BA 03) — form món mới điền sẵn từ món gốc, chỉ tạo khi bấm lưu
  const [params] = useSearchParams();
  const fromId = id ? null : params.get('from');
  const source = useDish(fromId, { live: false });
  const { items: others } = useDishes({});
  // Giá trị gốc để so sánh "đã sửa chưa": form trống (mới) hoặc dữ liệu nạp từ server
  const [initial, setInitial] = useState(EMPTY);
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
    if (!source.item) return;
    const loaded = duplicateDishForm(source.item, AGE_IDS, NEW_STATUS);
    setForm(loaded);
    setInitial(loaded);
  }, [source.item]);

  useEffect(() => {
    let loaded = null;
    if (item) {
      // Món chưa có ageGroupIds (dữ liệu cũ) ⇒ mặc định đủ nhóm đang áp dụng
      const agIds = item.ageGroupIds?.length ? item.ageGroupIds : AGE_IDS;
      loaded = {
        name: item.name,
        type: item.type,
        description: item.description,
        status: item.status,
        ageGroupIds: agIds,
        ingredients: item.ingredients.map((ing) => recipeRow(ing, agIds)),
      };
    } else if (!id && !fromId) loaded = EMPTY;
    if (!loaded) return;
    setForm(loaded);
    setInitial(loaded);
  }, [item, id, fromId]);

  const activeGroups = activeAgeGroups(catalog.nutritionSetups);
  // G94-379: chỉ hiện cột định lượng của các nhóm tuổi giáo viên đã chọn (kiểu PMS); nhóm không còn active bị lọc
  const dishGroups = activeGroups.filter((a) => (form.ageGroupIds || []).includes(a.id));
  const toggleGroup = (ag) => {
    const selected = form.ageGroupIds?.includes(ag);
    set('ageGroupIds', selected ? form.ageGroupIds.filter((x) => x !== ag) : [...(form.ageGroupIds || []), ag]);
    if (selected && copyFrom === ag) setCopyFrom('');
    if (selected && copyTo === ag) setCopyTo('');
  };
  const foodOptions = useMemo(
    () =>
      catalog.foods
        .filter((f) => f.status === RECORD_STATUS.ACTIVE || form.ingredients.some((r) => r.foodId === f.id))
        .map((f) => ({ value: f.id, label: f.name, searchText: `${f.name} ${FOOD_GROUP_LABELS[f.group]}` })),
    [catalog.foods, form.ingredients],
  );

  const title = id ? 'Sửa món ăn' : fromId ? 'Nhân bản món ăn' : 'Thêm món ăn';
  // Món mới hoặc món Nháp: chọn Lưu nháp / Lưu và dùng cho thực đơn (user chốt 20/10/2026)
  const draftMode = HAS_DRAFT && (!id || item?.status === DISH_STATUS.DRAFT);
  const requireGroups = dishGroups.map((a) => ({ id: a.id, name: ageAbbr(a.id) }));
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
  const noQtyGroups = dishGroups.filter((a) => dishTotals(preview, catalog.foodById, 1, a.id).noQuantity);
  const noNutrition = usedFoods.filter((f) => !hasNutrition(f)).map((f) => f.name);
  const noOrigin = usedFoods.filter((f) => hasNutrition(f) && !hasOrigin(f)).map((f) => f.name);
  const noPrice = usedFoods.filter((f) => !f.unitPrice).map((f) => f.name);
  const allergens = dishAllergens(preview, catalog.foodById);
  const checks = [
    ...noQtyGroups.map((a) => ({ tone: 'bad', text: `Cột ${ageAbbr(a.id)} chưa có định lượng: món chưa dùng được cho ${ageAbbr(a.id)}.` })),
    ...(noNutrition.length ? [{ tone: 'warn', text: `Thiếu số liệu dinh dưỡng: ${noNutrition.join(', ')}.` }] : []),
    ...(noOrigin.length ? [{ tone: 'warn', text: `Chưa có nguồn gốc động vật / thực vật: ${noOrigin.join(', ')}.` }] : []),
    ...(noPrice.length ? [{ tone: 'warn', text: `Chưa có đơn giá: ${noPrice.join(', ')}.` }] : []),
  ];
  if (!checks.length && preview.ingredients.length && dishGroups.length)
    checks.push({ tone: 'ok', text: `Đủ định lượng và số liệu cho ${dishGroups.length} nhóm tuổi.` });

  const dirty =
    ['name', 'type', 'description', 'status'].some((k) => form[k] !== initial[k]) ||
    JSON.stringify(form.ageGroupIds) !== JSON.stringify(initial.ageGroupIds) ||
    JSON.stringify(form.ingredients) !== JSON.stringify(initial.ingredients);
  // Lưu từ hộp rời màn: giữ trạng thái hiện tại (món mới/nháp ⇒ lưu nháp, không tự kích hoạt)
  const guard = useLeaveGuard({ when: dirty && !busy, onSave: () => submit(null, false, form.status, true) });

  // Trả true khi lưu được; stay: lưu từ hộp rời màn (hộp tự chuyển tới nơi người dùng bấm)
  const submit = async (e, again = false, status = form.status, stay = false) => {
    e?.preventDefault();
    setSubmitted(true);
    if (hasErrors(Object.fromEntries(Object.entries(errors).filter(([, v]) => v)))) return false;
    const activating = status === DISH_STATUS.ACTIVE && draftMode;
    const statusCheck = activating ? validateDish({ ...form, status, id }, others, { requireGroups }).status : '';
    setStatusError(statusCheck || '');
    if (statusCheck) return false;
    setBusy(true);
    try {
      await saveDish(id, { ...form, status }, user);
      toast.success('Lưu thay đổi thành công.');
      if (stay) return true;
      if (again) {
        setForm(EMPTY);
        setInitial(EMPTY);
        setSubmitted(false);
        setTouched({});
        guard.leaveNow('/menu/dishes/new');
      } else guard.leaveNow('/menu/dishes');
      return true;
    } catch (err) {
      if (err.details) setServerErrors(err.details);
      if (err.details?.status) setStatusError(err.details.status);
      toast.error(err, 'Không lưu được thay đổi');
      return false;
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
            <>
              <Link className="btn" to="/menu/dishes">
                <X size={16} /> Hủy
              </Link>
              {draftMode ? (
                <>
                  <Button disabled={busy} onClick={() => submit(null, false, DISH_STATUS.DRAFT)}>
                    <Save size={16} /> Lưu nháp
                  </Button>
                  <Button variant="primary" disabled={busy} onClick={() => submit(null, false, DISH_STATUS.ACTIVE)}>
                    {busy ? <Spinner small /> : <Save size={16} />} Lưu và dùng cho thực đơn
                  </Button>
                </>
              ) : (
                <>
                  <Button disabled={busy} onClick={() => submit(null, true)}>
                    <Save size={16} /> Lưu & thêm mới
                  </Button>
                  <Button type="submit" variant="primary" disabled={busy}>
                    {busy ? <Spinner small /> : <Save size={16} />} Lưu
                  </Button>
                </>
              )}
            </>
          }
        />

        {statusError && (
          <div className="alert alert--danger mb-16" role="alert">
            <AlertTriangle size={18} />
            <div>{statusError}</div>
          </div>
        )}
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Thông tin món ăn</h2>
          </div>
          <div className="card__body td-form-grid">
            <FormField label="Tên món" required error={show('name')}>
              <TextField
                className="input"
                value={form.name}
                maxLength={100}
                onChange={(e) => set('name', e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              />
            </FormField>
            <FormField label="Loại món" required error={show('type')}>
              <SelectField
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
              </SelectField>
            </FormField>
            <div className="field td-span-all">
              <span className="field__label" id="td-dish-groups">
                Nhóm trẻ áp dụng<span className="req">*</span>
              </span>
              <div className="td-group-pick" role="group" aria-labelledby="td-dish-groups">
                {activeGroups.map((a) => (
                  <label key={a.id}>
                    <Checkbox checked={(form.ageGroupIds || []).includes(a.id)} onChange={() => toggleGroup(a.id)} />
                    {ageAbbr(a.id)}
                  </label>
                ))}
              </div>
              {show('ageGroupIds') && <span className="field__error">{errors.ageGroupIds}</span>}
            </div>
          </div>
        </section>

        {/* Chưa có cảnh báo tự kiểm thì không chừa cột phải trống: bảng thành phần chiếm cả bề ngang */}
        <div className={`td-split-aside ${checks.length ? '' : 'td-split-aside--solo'}`}>
          <section className="card">
            <div className="card__header">
              <h2 className="card__title">Nguyên liệu món</h2>
              <span className="text-sm muted">Thực mua tự tính từ % thải bỏ của thực phẩm</span>
            </div>
            {dishGroups.length > 1 && (
              <div className="filter-bar td-recipe-copy">
                <span className="text-sm">Chép định lượng từ</span>
                <SelectField
                  className="select"
                  value={copyFrom}
                  onChange={(e) => setCopyFrom(e.target.value)}
                  aria-label="Chép định lượng từ nhóm"
                >
                  <option value="">Chọn nhóm</option>
                  {dishGroups.map((a) => (
                    <option key={a.id} value={a.id}>
                      {ageAbbr(a.id)}
                    </option>
                  ))}
                </SelectField>
                <span className="text-sm">sang</span>
                <SelectField
                  className="select"
                  value={copyTo}
                  onChange={(e) => setCopyTo(e.target.value)}
                  aria-label="Chép định lượng sang nhóm"
                >
                  <option value="">Chọn nhóm</option>
                  {dishGroups
                    .filter((a) => a.id !== copyFrom)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {ageAbbr(a.id)}
                      </option>
                    ))}
                </SelectField>
                <Button onClick={startCopy} disabled={!copyFrom || !copyTo || copyFrom === copyTo}>
                  <Copy size={15} /> Chép
                </Button>
              </div>
            )}
            {copied.length > 0 && (
              <div className="alert alert--warning td-recipe-copied">
                <AlertTriangle size={18} />
                <div>Vừa chép định lượng cho {copied.map(ageAbbr).join(', ')} — kiểm tra lại từng ô trước khi lưu.</div>
              </div>
            )}
            <div className="table-wrap td-recipe-wrap">
              <table className="table table--grid table--compact table--wrap-head td-recipe">
                <thead>
                  <tr>
                    <th rowSpan={2} className="num cell--fixed">
                      STT
                    </th>
                    <th rowSpan={2}>
                      Thành phần <span className="req">*</span>
                    </th>
                    <th rowSpan={2} className="cell--fixed center">
                      ĐVT
                    </th>
                    {dishGroups.map((a) => (
                      <Fragment key={a.id}>
                        <th colSpan={2} className="center td-qty-group">
                          {ageAbbr(a.id)}
                          {copied.includes(a.id) && (
                            <span className="chip chip--orange td-copied-chip" title="Vừa chép — kiểm tra lại">
                              Vừa chép
                            </span>
                          )}
                        </th>
                      </Fragment>
                    ))}
                    <th rowSpan={2} className="cell--actions">
                      Thao tác
                    </th>
                  </tr>
                  <tr>
                    {dishGroups.map((a) => (
                      <Fragment key={a.id}>
                        <th className="num">Thực ăn</th>
                        <th className="num muted">Thực mua</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.ingredients.map((r, i) => {
                    const food = catalog.foodById[r.foodId];
                    const qtyErr = dishGroups.map((a) => errors[`ing_${i}_${a.id}`]).find(Boolean);
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
                        <td className="muted cell--fixed center">{food?.unit || 'g'}</td>
                        {dishGroups.map((a) => {
                          const v = r.portions[a.id];
                          const bad = submitted && errors[`ing_${i}_${a.id}`];
                          // G94-379: Thực mua tự tính từ % thải bỏ (display-only, không lưu)
                          const purchased = v !== '' && v != null ? purchaseQty(Number(v), food?.wastePct) : null;
                          return (
                            <Fragment key={a.id}>
                              <td className="num">
                                <TextField
                                  type="number"
                                  min="0"
                                  step="1"
                                  className={`input td-qty ${v == null || v === '' ? 'td-qty--empty' : ''} ${bad ? 'is-invalid' : ''}`}
                                  value={v ?? ''}
                                  placeholder="Nhập"
                                  title={bad || undefined}
                                  onChange={(e) => setQty(i, a.id, e.target.value)}
                                  aria-label={`Thực ăn ${food?.name || `thực phẩm ${i + 1}`} cho ${a.name}`}
                                />
                              </td>
                              <td className="num muted nowrap" title="Tự tính: thực ăn ÷ (1 − % thải bỏ)">
                                {purchased == null ? '—' : `${g(purchased)} ${food?.unit || ''}`.trim()}
                              </td>
                            </Fragment>
                          );
                        })}
                        <td className="cell--actions">
                          <Button
                            variant="icon"
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
                          </Button>
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
                    {dishGroups.map((a) => {
                      const t = dishTotals(preview, catalog.foodById, 1, a.id);
                      return (
                        <td key={a.id} colSpan={2} className="num nowrap cell--fixed">
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
              <Button variant="link" onClick={() => set('ingredients', [...form.ingredients, emptyRow()])}>
                <Plus size={16} /> Thêm thành phần
              </Button>
            </div>
          </section>

          {checks.length > 0 && (
            <div className="td-aside-stack">
              <AutoChecks items={checks} />
            </div>
          )}
        </div>
        <section className="card td-portion-card">
          <div className="card__header">
            <h2 className="card__title">Dinh dưỡng và chi phí 1 suất</h2>
            <span className="text-sm muted">Theo định lượng đang nhập; chi phí đã cộng hệ số thải bỏ</span>
          </div>
          <DishPortionTable dish={preview} foodById={catalog.foodById} groups={dishGroups} />
        </section>
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
      <LeaveConfirmModal {...guard.modal} />
    </div>
  );
}
