import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSupplier } from '@/hooks/kitchen/useKitchen';
import { Breadcrumb, ErrorState, FormField, LoadingState, Spinner } from '@/components';
import { saveSupplier, suppliersUseApi } from '@/services/kitchen/kitchenService';
import { validateSupplier } from '@/utils/kitchen/kitchenValidation';
import { supplierCrumbs } from '@/utils/kitchen/breadcrumbs';
import { SUPPLIER_STATUS, SUPPLIER_STATUS_LABELS } from '@/models/kitchen/kitchenConstants';
import '@/styles/modules/kitchen.css';

const EMPTY = { name: '', address: '', contactName: '', phone: '', taxCode: '', idCard: '', status: SUPPLIER_STATUS.ACTIVE };
// BE: không có mã NCC, mã số thuế; có CCCD người giao hàng
const VIA_API = suppliersUseApi();
const pick = (s) => Object.fromEntries(Object.keys(EMPTY).map((k) => [k, s[k] ?? '']));

/** Thêm/sửa nhà cung cấp (BA 01 Supplier Form): chỉ HT; mã do hệ thống sinh, bắt buộc tên. */
export default function SupplierFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const existing = useSupplier(id, { live: false });
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing.data) setForm(pick(existing.data));
  }, [existing.data]);

  const errors = { ...validateSupplier(form), ...serverErrors };
  const show = (k) => (submitted || touched[k] ? errors[k] : undefined);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    // Xóa hẳn khóa: để `undefined` thì spread vào errors sẽ đè mất lỗi kiểm tra của ô
    setServerErrors(({ [k]: _drop, ...rest }) => rest);
  };
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const backTo = id ? `/menu/suppliers/${id}` : '/menu/suppliers';
  const title = id ? `Sửa nhà cung cấp ${existing.data?.code || ''}` : 'Thêm nhà cung cấp';

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    try {
      const saved = await saveSupplier({ ...form, id: id || null }, user);
      toast.success(id ? 'Lưu thay đổi thành công.' : `Đã thêm nhà cung cấp ${saved.code || saved.name}.`);
      navigate(`/menu/suppliers/${saved.id}`);
    } catch (err) {
      if (err.details) setServerErrors(err.details);
      toast.error(err.message || 'Không lưu được thay đổi. Vui lòng thử lại.', 'Không lưu được nhà cung cấp');
    } finally {
      setBusy(false);
    }
  };

  const crumbs = supplierCrumbs(id ? 'Sửa' : 'Thêm mới');
  if (id && existing.loading) return <LoadingState />;
  if (id && existing.error)
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <ErrorState error={existing.error} onRetry={existing.reload} />
      </div>
    );

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <h1 className="page__title">{title}</h1>
      <form onSubmit={submit} noValidate>
        <div className="page-actions page-actions--top">
          <button type="button" className="btn" onClick={() => navigate(backTo)}>
            <ArrowLeft size={16} /> Hủy
          </button>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner small /> : <Save size={16} />} Lưu nhà cung cấp
          </button>
        </div>
        <div className="card wizard-card">
          <div className="card__header">
            <div className="card__title">Thông tin nhà cung cấp</div>
          </div>
          <div className="card__body grid-2">
            {!VIA_API && (
              <FormField label="Mã nhà cung cấp" hint="Hệ thống tự sinh, không sửa được">
                <input className="input" value={existing.data?.code || 'Tự sinh khi lưu'} readOnly disabled />
              </FormField>
            )}
            <FormField label="Tên nhà cung cấp" required error={show('name')}>
              <input
                className="input"
                value={form.name}
                maxLength={150}
                onChange={(e) => set('name', e.target.value)}
                onBlur={blur('name')}
              />
            </FormField>
            <FormField label={VIA_API ? 'Người giao hàng' : 'Người liên hệ'} error={show('contactName')}>
              <input
                className="input"
                value={form.contactName}
                maxLength={100}
                onChange={(e) => set('contactName', e.target.value)}
                onBlur={blur('contactName')}
              />
            </FormField>
            <FormField label="Số điện thoại" error={show('phone')} hint="Ví dụ: 0900 000 001">
              <input
                className="input"
                type="tel"
                inputMode="tel"
                value={form.phone}
                maxLength={20}
                onChange={(e) => set('phone', e.target.value)}
                onBlur={blur('phone')}
              />
            </FormField>
            {VIA_API ? (
              <FormField label="CCCD người giao hàng" error={show('idCard')} hint="9–12 chữ số, không bắt buộc">
                <input
                  className="input"
                  inputMode="numeric"
                  value={form.idCard}
                  maxLength={12}
                  onChange={(e) => set('idCard', e.target.value)}
                  onBlur={blur('idCard')}
                />
              </FormField>
            ) : (
              <FormField label="Mã số thuế" error={show('taxCode')} hint="Không bắt buộc">
                <input
                  className="input"
                  value={form.taxCode}
                  maxLength={14}
                  onChange={(e) => set('taxCode', e.target.value)}
                  onBlur={blur('taxCode')}
                />
              </FormField>
            )}
            <FormField label="Trạng thái" hint="Ngừng dùng: không chọn được cho phiếu nhập mới">
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {Object.entries(SUPPLIER_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Địa chỉ" error={show('address')} className="kb-span-all">
              <input
                className="input"
                value={form.address}
                maxLength={255}
                onChange={(e) => set('address', e.target.value)}
                onBlur={blur('address')}
              />
            </FormField>
          </div>
        </div>
      </form>
    </div>
  );
}
