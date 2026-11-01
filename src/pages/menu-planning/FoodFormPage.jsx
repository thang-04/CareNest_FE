import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useFood, useFoods, useMenuAccess } from '@/hooks/menu-planning/useMenuPlanning';
import { saveFood } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { validateFood, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { foodUnits, purchaseUnitSizeOf } from '@/utils/menu-planning/foodUnits';
import { foodCrumbs } from '@/utils/menu-planning/breadcrumbs';
import {
  ALLERGENS,
  FOOD_GROUP_LABELS,
  FOOD_UNIT_LABELS,
  RECORD_STATUS_LABELS,
  FOOD_STORAGE_LABELS,
  defaultStorageOf,
} from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const EMPTY = {
  name: '',
  group: '',
  unit: 'g',
  purchaseUnit: 'kg',
  purchaseUnitSize: 1000,
  stockUnit: 'kg',
  purchaseToStock: 1,
  stockUnitSize: 1000,
  unitPrice: '',
  wastePct: 0,
  favorite: false,
  storage: '',
  nutrition: { kcal: '', protein: '', lipid: '', glucid: '' },
  allergens: [],
  note: '',
  status: 'ACTIVE',
};
const toForm = (f) => ({
  ...EMPTY,
  ...f,
  ...foodUnits(f),
  unit: f.unit,
  unitPrice: f.unitPrice ?? '',
  nutrition: Object.fromEntries(Object.entries(f.nutrition || {}).map(([k, v]) => [k, v ?? ''])),
});

/** Screen #70 – the Vice Principal (shared services) creates or edits a food item (UC 6.4). */
export default function FoodFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const access = useMenuAccess();
  const { item, loading, error, reload } = useFood(id, { live: false });
  const { items: others } = useFoods({});
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) setForm(toForm(item));
  }, [item]);

  const title = id ? 'Sửa thực phẩm' : 'Thêm thực phẩm';
  // Số g/ml trong 1 đơn vị mua suy ra từ hai tỷ lệ, không nhập riêng
  const payload = { ...form, purchaseUnitSize: purchaseUnitSizeOf(form.purchaseToStock, form.stockUnitSize) };
  const errors = { ...validateFood({ ...payload, id }, others), ...serverErrors };
  const locked = !!item?.unitsLocked;
  const num = (v) => Number(v).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
  const unitPreview =
    Number(form.purchaseToStock) > 0 && Number(form.stockUnitSize) > 0 && form.stockUnit && form.purchaseUnit
      ? `1 ${form.purchaseUnit} = ${num(form.purchaseToStock)} ${form.stockUnit} = ${num(payload.purchaseUnitSize)} ${form.unit}`
      : null;
  const show = (k) => (submitted || touched[k] ? errors[k] : undefined);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    // Xóa hẳn khóa: để `undefined` thì spread vào errors sẽ đè mất lỗi kiểm tra của ô
    setServerErrors(({ [k]: _drop, ...rest }) => rest);
  };
  const setNut = (k, v) => setForm((f) => ({ ...f, nutrition: { ...f.nutrition, [k]: v } }));
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const toggleAllergen = (a) =>
    set('allergens', form.allergens.includes(a) ? form.allergens.filter((x) => x !== a) : [...form.allergens, a]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    const clean = Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
    if (hasErrors(clean)) return;
    setBusy(true);
    try {
      const saved = await saveFood(id, payload, user);
      toast.success('Lưu thay đổi thành công.');
      navigate(`/menu/foods/${saved.id}`);
    } catch (err) {
      if (err.details) setServerErrors(err.details);
      toast.error(err, 'Không lưu được thay đổi');
    } finally {
      setBusy(false);
    }
  };

  if (access.loading || loading) return <LoadingState />;
  if (!access.canManage)
    return (
      <div className="page">
        <Breadcrumb items={foodCrumbs(title)} />
        <h1 className="page__title">{title}</h1>
        <NoManageAccess />
      </div>
    );
  if (id && error)
    return (
      <div className="page">
        <Breadcrumb items={foodCrumbs(title)} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={foodCrumbs(title)} />
      <h1 className="page__title">{id ? `Sửa thực phẩm ${item?.code || ''}` : title}</h1>
      <form onSubmit={submit} noValidate>
        <div className="card wizard-card">
          <div className="card__header">
            <div className="card__title">Thông tin chung</div>
          </div>
          <div className="card__body td-form-grid">
            <FormField label="Tên thực phẩm" required error={show('name')} className="td-span-all">
              <input
                className="input"
                value={form.name}
                maxLength={100}
                onChange={(e) => set('name', e.target.value)}
                onBlur={blur('name')}
              />
            </FormField>
            <FormField label="Nhóm thực phẩm" required error={show('group')}>
              <select className="select" value={form.group} onChange={(e) => set('group', e.target.value)} onBlur={blur('group')}>
                <option value="">Chọn nhóm</option>
                {Object.entries(FOOD_GROUP_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Đơn vị công thức"
              required
              error={show('unit')}
              hint="Khối lượng (g) hoặc thể tích (ml) khi nhập định lượng món; không tự đổi lít ↔ gam"
            >
              <select className="select" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                {Object.entries(FOOD_UNIT_LABELS).map(([k, v]) => (
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
            <FormField label="Đơn giá (đồng / đơn vị mua)" error={show('unitPrice')} hint="Dùng ước tính chi phí suất ăn">
              <input
                type="number"
                min="0"
                step="500"
                className="input"
                value={form.unitPrice}
                onChange={(e) => set('unitPrice', e.target.value)}
                onBlur={blur('unitPrice')}
              />
            </FormField>
            <FormField label="Tỷ lệ thải bỏ (%)" error={show('wastePct')} hint="Phần bỏ đi khi sơ chế; dùng tính lượng mua">
              <input
                type="number"
                min="0"
                max="90"
                step="1"
                className="input"
                value={form.wastePct}
                onChange={(e) => set('wastePct', e.target.value)}
                onBlur={blur('wastePct')}
              />
            </FormField>
            <FormField label="Bảo quản" error={show('storage')} hint="Tươi: giao trong ngày; khô: lấy từ kho">
              <select
                className="select"
                value={form.storage || defaultStorageOf(form.group)}
                onChange={(e) => set('storage', e.target.value)}
              >
                {Object.entries(FOOD_STORAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </FormField>
            <label className="checkbox td-checkbox-field">
              <input type="checkbox" checked={!!form.favorite} onChange={(e) => set('favorite', e.target.checked)} />
              Hay dùng (lọc nhanh khi lập món)
            </label>
          </div>
        </div>

        <div className="card wizard-card mt-16">
          <div className="card__header">
            <div className="card__title">Đơn vị & quy đổi</div>
            {unitPreview && <span className="text-sm muted">{unitPreview}</span>}
          </div>
          <div className="card__body td-form-grid">
            <FormField
              label="Đơn vị kho"
              required
              error={show('stockUnit')}
              hint={locked ? 'Đã có lô tồn kho hoặc phiếu nhập: không đổi được' : 'Đơn vị tính tồn và xuất kho, ví dụ kg, hộp'}
            >
              <input
                className="input"
                value={form.stockUnit}
                maxLength={30}
                disabled={locked}
                onChange={(e) => set('stockUnit', e.target.value)}
                onBlur={blur('stockUnit')}
              />
            </FormField>
            <FormField
              label={`Số ${form.unit} trong 1 ${form.stockUnit || 'đơn vị kho'}`}
              required
              error={show('stockUnitSize')}
              hint={locked ? 'Đã có lô tồn kho hoặc phiếu nhập: không đổi được' : 'Dùng đổi định lượng món sang lượng xuất kho'}
            >
              <input
                type="number"
                min="0"
                step="any"
                className="input"
                value={form.stockUnitSize}
                disabled={locked}
                onChange={(e) => set('stockUnitSize', e.target.value)}
                onBlur={blur('stockUnitSize')}
              />
            </FormField>
            <FormField label="Đơn vị mua" required error={show('purchaseUnit')} hint="Ví dụ: kg, lít, thùng, bao 10 kg">
              <input
                className="input"
                value={form.purchaseUnit}
                maxLength={30}
                onChange={(e) => set('purchaseUnit', e.target.value)}
                onBlur={blur('purchaseUnit')}
              />
            </FormField>
            <FormField
              label={`Số ${form.stockUnit || 'đơn vị kho'} trong 1 ${form.purchaseUnit || 'đơn vị mua'}`}
              required
              error={show('purchaseToStock')}
              hint="Cùng đơn vị thì nhập 1; dùng khi nhập kho theo đơn vị mua và làm tròn lượng cần mua"
            >
              <input
                type="number"
                min="0"
                step="any"
                className="input"
                value={form.purchaseToStock}
                onChange={(e) => set('purchaseToStock', e.target.value)}
                onBlur={blur('purchaseToStock')}
              />
            </FormField>
          </div>
        </div>

        <div className="card wizard-card mt-16">
          <div className="card__header">
            <div className="card__title">Giá trị dinh dưỡng trên 100 {form.unit}</div>
          </div>
          <div className="card__body">
            <div className="td-form-grid td-form-grid--4">
              {[
                ['kcal', 'Năng lượng (kcal)'],
                ['protein', 'Chất đạm (g)'],
                ['lipid', 'Chất béo (g)'],
                ['glucid', 'Tinh bột (g)'],
              ].map(([k, label]) => (
                <FormField key={k} label={label} error={show(k)}>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    className="input"
                    value={form.nutrition[k]}
                    onChange={(e) => setNut(k, e.target.value)}
                    onBlur={blur(k)}
                  />
                </FormField>
              ))}
            </div>
            <p className="text-xs muted mt-8">
              Để trống nếu chưa có số liệu – các thực đơn dùng thực phẩm này sẽ được báo là tính toán chưa đầy đủ.
            </p>
          </div>
        </div>

        <div className="card wizard-card mt-16">
          <div className="card__header">
            <div className="card__title">Chất gây dị ứng</div>
          </div>
          <div className="card__body">
            <fieldset className="td-allergen-pick">
              <legend className="sr-only">Chọn chất gây dị ứng có trong thực phẩm</legend>
              {ALLERGENS.map((a) => (
                <label key={a}>
                  <input type="checkbox" checked={form.allergens.includes(a)} onChange={() => toggleAllergen(a)} /> {a}
                </label>
              ))}
            </fieldset>
            <FormField label="Ghi chú" className="mt-16">
              <textarea className="textarea" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
            </FormField>
          </div>
        </div>

        <div className="page-actions">
          <button type="button" className="btn" onClick={() => navigate(id ? `/menu/foods/${id}` : '/menu/foods')}>
            <ArrowLeft size={16} /> Hủy
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner small /> : <Save size={16} />} Lưu thực phẩm
          </button>
        </div>
      </form>
    </div>
  );
}
