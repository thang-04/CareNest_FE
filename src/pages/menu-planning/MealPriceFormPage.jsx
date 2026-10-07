import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMealPrice, useMealPrices, useMenuAccess } from '@/hooks/menu-planning/useMenuPlanning';
import { saveMealPrice } from '@/services/menu-planning/menuPlanningService';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { FormField } from '@/components/form/FormField';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { NoManageAccess } from '@/components/menu-planning/MenuBadges';
import { validateMealPrice, hasErrors } from '@/utils/menu-planning/menuPlanningValidation';
import { priceCrumbs } from '@/utils/menu-planning/breadcrumbs';
import { todayInput } from '@/utils/format';
import { AGE_GROUPS, ageGroupById } from '@/models/School';
import { formatMoney } from '@/models/menu-planning/menuPlanningConstants';
import '@/styles/modules/menu-planning.css';

const EMPTY = { ageGroupId: '', price: '', effectiveFrom: '', effectiveTo: '', note: '', reason: '' };

/** Screen #76 – the Vice Principal (shared services) sets the price of one meal (UC 6.3). */
export default function MealPriceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const access = useMenuAccess();
  const { item, loading, error, reload } = useMealPrice(id, { live: false });
  const { items: others } = useMealPrices({});
  const [form, setForm] = useState(EMPTY);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (item) setForm({ ...EMPTY, ...item, effectiveTo: item.effectiveTo || '' });
  }, [item]);

  const inForce = !!item && item.effectiveFrom <= todayInput();
  const errors = { ...validateMealPrice({ ...form, id }, others), ...serverErrors };
  if (inForce && !form.reason.trim()) errors.reason = 'Giá này đã được áp dụng. Hãy nhập lý do thay đổi.';
  const show = (k) => (submitted ? errors[k] : undefined);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    setServerErrors({});
  };
  const title = id ? 'Sửa giá suất ăn' : 'Thêm giá suất ăn';

  const submit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (!hasErrors(errors)) setConfirm(true);
  };

  const save = async () => {
    try {
      await saveMealPrice(id, form, user);
      toast.success('Lưu thay đổi thành công.');
      navigate('/menu/prices');
    } catch (err) {
      setConfirm(false);
      if (err.details) setServerErrors(err.details);
      toast.error(err.message, 'Không lưu được thay đổi');
    }
  };

  if (access.loading || loading) return <LoadingState />;
  if (!access.canManage)
    return (
      <div className="page">
        <Breadcrumb items={priceCrumbs(title)} />
        <h1 className="page__title">{title}</h1>
        <NoManageAccess />
      </div>
    );
  if (id && error)
    return (
      <div className="page">
        <Breadcrumb items={priceCrumbs(title)} />
        <ErrorState error={error} onRetry={reload} />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={priceCrumbs(title)} />
      <h1 className="page__title">{title}</h1>
      <form onSubmit={submit} noValidate>
        <div className="card wizard-card">
          <div className="card__body td-form-grid td-form-grid--2">
            <FormField label="Nhóm tuổi" required error={show('ageGroupId')}>
              <select className="select" value={form.ageGroupId} onChange={(e) => set('ageGroupId', e.target.value)} disabled={!!id}>
                <option value="">Chọn nhóm tuổi</option>
                {AGE_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Giá một suất ăn (đồng / trẻ / ngày)" required error={show('price')}>
              <input
                type="number"
                min="0"
                step="1000"
                className="input"
                value={form.price}
                onChange={(e) => set('price', e.target.value)}
              />
            </FormField>
            <FormField label="Áp dụng từ ngày" required error={show('effectiveFrom')}>
              <input type="date" className="input" value={form.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} />
            </FormField>
            <FormField label="Đến ngày" error={show('effectiveTo')} hint="Để trống nếu áp dụng đến khi có giá mới">
              <input type="date" className="input" value={form.effectiveTo} onChange={(e) => set('effectiveTo', e.target.value)} />
            </FormField>
            <FormField label="Ghi chú" className="td-span-all">
              <input className="input" value={form.note} maxLength={200} onChange={(e) => set('note', e.target.value)} />
            </FormField>
            {inForce && (
              <FormField
                label="Lý do thay đổi"
                required
                error={show('reason')}
                className="td-span-all"
                hint="Giá đã áp dụng – thay đổi được ghi vào lịch sử"
              >
                <textarea className="textarea" rows={2} value={form.reason} onChange={(e) => set('reason', e.target.value)} />
              </FormField>
            )}
          </div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn" onClick={() => navigate('/menu/prices')}>
            <ArrowLeft size={16} /> Hủy
          </button>
          <button type="submit" className="btn btn--primary">
            <Save size={16} /> Lưu giá suất ăn
          </button>
        </div>
      </form>
      <ConfirmationModal
        open={confirm}
        title="Xác nhận giá suất ăn"
        message={`Lưu giá ${formatMoney(Number(form.price))} cho ${ageGroupById(form.ageGroupId)?.name || ''}?`}
        confirmLabel="Lưu giá suất ăn"
        onConfirm={save}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
