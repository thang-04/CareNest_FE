import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useFood, useFoods } from '@/hooks/menu-planning/useMenuPlanning';
import { saveFood } from '@/services/menu-planning/menuPlanningService';
import { validateFood, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { foodUnits, purchaseUnitSizeOf } from '@/utils/menu-planning/foodUnits';
import { MICRONUTRIENTS } from '@/models/menu-planning/menuPlanningConstants';

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
  nutrition: { kcal: '', protein: '', lipid: '', glucid: '', ...Object.fromEntries(MICRONUTRIENTS.map((k) => [k, ''])) },
  origin: '',
  nutrientSource: '',
  nutrientSourceVersion: '',
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
  origin: f.origin ?? '',
  nutrientSource: f.nutrientSource ?? '',
  nutrientSourceVersion: f.nutrientSourceVersion ?? '',
  nutrition: Object.fromEntries(Object.entries(f.nutrition || {}).map(([k, v]) => [k, v ?? ''])),
});

/**
 * Trạng thái form thêm / sửa thực phẩm, dùng chung cho trang `/menu/foods/:id/edit` và modal trên danh sách.
 * Kiểm nhập liệu chỉ hỗ trợ (validateFood); BE quyết định hợp lệ, lỗi 400 hiện tại ô.
 */
export function useFoodForm(id, { onSaved } = {}) {
  const { user } = useAuth();
  const toast = useToast();
  const { item, loading, error, reload } = useFood(id, { live: false });
  const { items: others } = useFoods({});
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm(item ? toForm(item) : EMPTY);
  }, [item]);

  // Số g/ml trong 1 đơn vị mua suy ra từ hai tỷ lệ, không nhập riêng
  const payload = { ...form, purchaseUnitSize: purchaseUnitSizeOf(form.purchaseToStock, form.stockUnitSize) };
  const errors = { ...validateFood({ ...payload, id }, others), ...serverErrors };
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
    e?.preventDefault();
    setSubmitted(true);
    const clean = Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
    if (hasErrors(clean)) return;
    setBusy(true);
    try {
      const saved = await saveFood(id, payload, user);
      toast.success('Lưu thay đổi thành công.');
      onSaved?.(saved);
    } catch (err) {
      if (err.details) setServerErrors(err.details);
      toast.error(err, 'Không lưu được thay đổi');
    } finally {
      setBusy(false);
    }
  };

  return {
    item,
    loading,
    error,
    reload,
    form,
    payload,
    set,
    setNut,
    blur,
    show,
    toggleAllergen,
    submit,
    busy,
    locked: !!item?.unitsLocked,
  };
}
