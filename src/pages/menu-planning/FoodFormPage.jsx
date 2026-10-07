import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useFood, useFoods, useMenuAccess } from '@/hooks/menu-planning/useMenuPlanning';
import { saveFood } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { ErrorState, LoadingState, Spinner } from '@/components/ui/States';
import { NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { validateFood, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { foodCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { ALLERGENS, FOOD_GROUP_LABELS, FOOD_UNIT_LABELS, RECORD_STATUS_LABELS } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const EMPTY = {
  name: '',
  group: '',
  unit: 'g',
  purchaseUnit: 'kg',
  purchaseUnitSize: 1000,
  unitPrice: '',
  nutrition: { kcal: '', protein: '', lipid: '', glucid: '' },
  allergens: [],
  note: '',
  status: 'ACTIVE',
};
const toForm = (f) => ({
  ...EMPTY,
  ...f,
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
  const errors = { ...validateFood({ ...form, id }, others), ...serverErrors };
  const show = (k) => (submitted || touched[k] ? errors[k] : undefined);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors((e) => ({ ...e, [k]: undefined }));
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
      const saved = await saveFood(id, form, user);
      toast.success('Lưu thay đổi thành công.');
      navigate(`/menu/foods/${saved.id}`);
    } catch (err) {
      if (err.details) setServerErrors(err.details);
      toast.error(err.message, 'Không lưu được thay đổi');
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
            <FormField label="Đơn vị định lượng" required error={show('unit')} hint="Dùng khi nhập định lượng trong món ăn">
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
            <FormField label="Đơn vị mua" required error={show('purchaseUnit')} hint="Ví dụ: kg, lít, quả, hộp 180 ml">
              <input
                className="input"
                value={form.purchaseUnit}
                onChange={(e) => set('purchaseUnit', e.target.value)}
                onBlur={blur('purchaseUnit')}
              />
            </FormField>
            <FormField
              label={`Số ${form.unit} trong một đơn vị mua`}
              required
              error={show('purchaseUnitSize')}
              hint="Dùng để làm tròn số lượng cần mua"
            >
              <input
                type="number"
                min="1"
                className="input"
                value={form.purchaseUnitSize}
                onChange={(e) => set('purchaseUnitSize', e.target.value)}
                onBlur={blur('purchaseUnitSize')}
              />
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
            <fieldset className="td-allergen-pick" style={{ border: 'none', padding: 0, margin: 0 }}>
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
