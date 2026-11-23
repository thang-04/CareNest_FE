import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useFood, useFoods } from '@/hooks/menu-planning/useMenuPlanning';
import { saveFood } from '@/services/menu-planning/menuPlanningService';
import { validateFood, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { autoUnitRatios, foodUnits, purchaseUnitSizeOf } from '@/utils/menu-planning/foodUnits';
import { MICRONUTRIENTS } from '@/models/menu-planning/menuPlanningConstants';

const UNIT_KEYS = ['unit', 'purchaseUnit', 'stockUnit'];

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
  // Giá trị đã tải từ server (hoặc form trống): so với form để biết còn thay đổi chưa lưu
  const [initial, setInitial] = useState(EMPTY);

  useEffect(() => {
    const loaded = item ? toForm(item) : EMPTY;
    setForm(loaded);
    setInitial(loaded);
  }, [item]);

  // Đã có lô/phiếu nhập: giữ nguyên tỷ lệ đã lưu, không tự đổi
  const locked = !!item?.unitsLocked;
  const auto = locked ? {} : autoUnitRatios(form);
  // Số g/ml trong 1 đơn vị mua suy ra từ hai tỷ lệ, không nhập riêng
  const ratios = { ...form, ...auto };
  const payload = { ...ratios, purchaseUnitSize: purchaseUnitSizeOf(ratios.purchaseToStock, ratios.stockUnitSize) };
  const errors = { ...validateFood({ ...payload, id }, others), ...serverErrors };
  const show = (k) => (submitted || touched[k] ? errors[k] : undefined);
  const set = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v };
      // Đổi đơn vị thì ô tỷ lệ tự điền được cập nhật theo, tránh số cũ hiện lại khi ô mở ra
      return !locked && UNIT_KEYS.includes(k) ? { ...next, ...autoUnitRatios(next) } : next;
    });
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
    if (hasErrors(clean)) {
      // Báo chung để người dùng thấy; ô lỗi không gắn ô nhập (vd purchaseUnitSize) thì chỉ có thông báo
      toast.error(`Còn ${Object.keys(clean).length} ô chưa hợp lệ, xem các ô báo đỏ`);
      requestAnimationFrame(() => {
        document.querySelector('.td-food-editor [aria-invalid="true"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
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
    setNut,
    blur,
    show,
    toggleAllergen,
    submit,
    busy,
    dirty: JSON.stringify(form) !== JSON.stringify(initial),
    locked,
    auto,
    // Giá và NCC chỉ nhập khi tạo; sau đó đổi qua điều chỉnh giá (NUT-27)
    isNew: !id,
  };
}
