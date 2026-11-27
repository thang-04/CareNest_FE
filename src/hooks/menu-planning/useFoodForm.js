import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useFood, useFoods } from '@/hooks/menu-planning/useMenuPlanning';
import { saveFood } from '@/services/menu-planning/menuPlanningService';
import { validateFood, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { foodUnits, selectNewFoodBaseUnit, selectNewFoodPurchaseUnit } from '@/utils/menu-planning/foodUnits';
import { MICRONUTRIENTS } from '@/models/menu-planning/menuPlanningConstants';
import { todayInput } from '@/utils/format';

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
  supplierId: '',
  // Chỉ gửi khi sửa mà giá hoặc NCC đổi: ngày hiệu lực của mức giá mới và lý do (NUT-27)
  effectiveFrom: '',
  priceReason: '',
  wastePct: 0,
  favorite: false,
  storage: '',
  nutrition: { kcal: '', protein: '', lipid: '', glucid: '', ...Object.fromEntries(MICRONUTRIENTS.map((k) => [k, ''])) },
  origin: '',
  nutrientSource: '',
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
  supplierId: f.supplierId ?? '',
  effectiveFrom: todayInput(),
  priceReason: '',
  origin: f.origin ?? '',
  nutrientSource: f.nutrientSource ?? '',
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
  // Giá trị đã tải từ server (hoặc form trống): so với form để biết còn thay đổi chưa lưu
  const [initial, setInitial] = useState(EMPTY);

  useEffect(() => {
    const loaded = item ? toForm(item) : EMPTY;
    setForm(loaded);
    setInitial(loaded);
  }, [item]);

  // Đã có lô/phiếu nhập: giữ nguyên tỷ lệ đã lưu, không tự đổi
  const locked = !!item?.unitsLocked;
  const payload = { ...form };
  // Sửa mà giá hoặc NCC khác bản đã tải ⇒ BE thêm mức giá mới: cần ngày hiệu lực và lý do (NUT-27)
  const priceChanged =
    !!id &&
    (String(form.unitPrice ?? '') !== String(initial.unitPrice ?? '') ||
      String(form.supplierId ?? '') !== String(initial.supplierId ?? ''));
  const errors = {
    ...validateFood({ ...payload, id }, others),
    ...(priceChanged && !form.effectiveFrom ? { effectiveFrom: 'Chọn ngày hiệu lực' } : {}),
    ...serverErrors,
  };
  const show = (k) => (submitted || touched[k] ? errors[k] : undefined);
  const set = (k, v) => {
    setForm((f) => {
      return { ...f, [k]: v };
    });
    // Xóa hẳn khóa: để `undefined` thì spread vào errors sẽ đè mất lỗi kiểm tra của ô
    setServerErrors(({ [k]: _drop, ...rest }) => rest);
  };
  const setNut = (k, v) => setForm((f) => ({ ...f, nutrition: { ...f.nutrition, [k]: v } }));
  const clearUnitErrors = () =>
    setServerErrors(
      ({
        unit: _unit,
        purchaseUnit: _purchaseUnit,
        purchaseUnitSize: _size,
        stockUnitSize: _stockSize,
        purchaseToStock: _ratio,
        ...rest
      }) => rest,
    );
  const setPurchaseUnit = (value) => {
    if (id) set('purchaseUnit', value);
    else setForm((f) => selectNewFoodPurchaseUnit(f, value));
    clearUnitErrors();
  };
  const setBaseUnit = (value) => {
    if (id) set('unit', value);
    else setForm((f) => selectNewFoodBaseUnit(f, value));
    clearUnitErrors();
  };
  const setUnitConversion = (v) => {
    setForm((f) => ({ ...f, purchaseUnitSize: v, purchaseToStock: Number(v) / Number(f.stockUnitSize) }));
    setServerErrors(({ purchaseUnitSize: _drop, stockUnitSize: _stockDrop, purchaseToStock: _ratioDrop, ...rest }) => rest);
  };
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const toggleAllergen = (a) =>
    set('allergens', form.allergens.includes(a) ? form.allergens.filter((x) => x !== a) : [...form.allergens, a]);

  const submit = async (e) => {
    e?.preventDefault();
    setSubmitted(true);
    const clean = Object.fromEntries(Object.entries(errors).filter(([, v]) => v));
    if (hasErrors(clean)) {
      // Lưu mà còn lỗi phải có phản hồi: báo số ô lỗi và cuộn tới ô đầu tiên
      toast.error(`Còn ${Object.keys(clean).length} ô chưa hợp lệ, xem các ô báo đỏ.`);
      requestAnimationFrame(() => document.querySelector('.td-food-editor [aria-invalid="true"]')?.scrollIntoView({ block: 'center' }));
      return false;
    }
    setBusy(true);
    try {
      const saved = await saveFood(id, payload, user);
      toast.success('Lưu thay đổi thành công.');
      setInitial(form);
      onSaved?.(saved);
      return true;
    } catch (err) {
      if (err.details) setServerErrors(err.details);
      toast.error(err, 'Không lưu được thay đổi');
      return false;
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
    setPurchaseUnit,
    setBaseUnit,
    setUnitConversion,
    setNut,
    blur,
    show,
    toggleAllergen,
    submit,
    busy,
    dirty: JSON.stringify(form) !== JSON.stringify(initial),
    locked,
    unitOptions: [
      ...new Set(
        [
          'kg',
          'g',
          'lít',
          'ml',
          'hộp',
          'chai',
          'gói',
          'quả',
          'thùng',
          form.purchaseUnit,
          ...others.map((food) => food.purchaseUnit),
        ].filter(Boolean),
      ),
    ].map((value) => ({ value, label: value })),
    isNew: !id,
    priceChanged,
  };
}
