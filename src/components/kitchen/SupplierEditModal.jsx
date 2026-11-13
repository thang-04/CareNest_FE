import { useEffect, useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSupplier } from '@/hooks/kitchen/useKitchen';
import { ErrorState, FormField, LoadingState, Modal, Spinner } from '@/components';
import { saveSupplier, suppliersUseApi } from '@/services/kitchen/kitchenService';
import { validateSupplier } from '@/utils/kitchen/kitchenValidation';
import { SUPPLIER_STATUS, SUPPLIER_STATUS_LABELS } from '@/models/kitchen/kitchenConstants';

const EMPTY = { name: '', address: '', contactName: '', phone: '', taxCode: '', idCard: '', status: SUPPLIER_STATUS.ACTIVE };
// BE: chưa có mã số thuế; mã NCC do FE sinh từ id (NCC001…); có CCCD nhà cung cấp
const VIA_API = suppliersUseApi();
const pick = (s) => Object.fromEntries(Object.keys(EMPTY).map((k) => [k, s[k] ?? '']));
const FORM_ID = 'kb-supplier-form';

/** Thêm / sửa nhà cung cấp ngay trên danh sách hoặc trang chi tiết (chỉ HT). `supplierId` rỗng = thêm mới. */
export function SupplierEditModal({ supplierId, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const existing = useSupplier(supplierId || undefined, { live: false });
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
  const text = (k, extra = {}) => ({
    className: 'input',
    value: form[k],
    onChange: (e) => set(k, e.target.value),
    onBlur: blur(k),
    ...extra,
  });

  const submit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    try {
      const saved = await saveSupplier({ ...form, id: supplierId || null }, user);
      toast.success(supplierId ? 'Lưu thay đổi thành công.' : `Đã thêm nhà cung cấp ${saved.code || saved.name}.`);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      if (err.details) setServerErrors(err.details);
      toast.error(err.message || 'Không lưu được thay đổi. Vui lòng thử lại.', 'Không lưu được nhà cung cấp');
    } finally {
      setBusy(false);
    }
  };

  const loading = !!supplierId && existing.loading;
  return (
    <Modal
      open
      size="lg"
      title={supplierId ? `Sửa nhà cung cấp${existing.data?.code ? ` · ${existing.data.code}` : ''}` : 'Thêm nhà cung cấp'}
      onClose={onClose}
      closeOnBackdrop={false}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" form={FORM_ID} className="btn btn--primary" disabled={busy || loading}>
            {busy ? <Spinner small /> : <Save size={16} />} Lưu nhà cung cấp
          </button>
        </>
      }
    >
      {loading ? (
        <LoadingState />
      ) : supplierId && existing.error ? (
        <ErrorState error={existing.error} onRetry={existing.reload} />
      ) : (
        <form id={FORM_ID} onSubmit={submit} noValidate className="kb-sup-form">
          <fieldset className="kb-sup-form__group">
            <legend>Thông tin chung</legend>
            <div className="grid-2">
              <FormField label="Tên nhà cung cấp" required error={show('name')}>
                <input {...text('name', { maxLength: 150 })} />
              </FormField>
              <FormField label="Trạng thái" hint="Ngừng dùng: không chọn được cho phiếu nhập mới">
                <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                  {Object.entries(SUPPLIER_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </FormField>
              {!VIA_API && (
                <FormField label="Mã nhà cung cấp" hint="Hệ thống tự sinh, không sửa được">
                  <input className="input" value={existing.data?.code || 'Tự sinh khi lưu'} readOnly disabled />
                </FormField>
              )}
            </div>
          </fieldset>
          <fieldset className="kb-sup-form__group">
            <legend>Liên hệ</legend>
            <div className="grid-2">
              <FormField label={VIA_API ? 'Người giao hàng' : 'Người liên hệ'} error={show('contactName')}>
                <input {...text('contactName', { maxLength: 100 })} />
              </FormField>
              <FormField label="Số điện thoại" error={show('phone')} hint="Ví dụ: 0900 000 001">
                <input {...text('phone', { type: 'tel', inputMode: 'tel', maxLength: 20 })} />
              </FormField>
              <FormField label="Địa chỉ" error={show('address')} className="kb-span-all">
                <input {...text('address', { maxLength: 255 })} />
              </FormField>
            </div>
          </fieldset>
          <fieldset className="kb-sup-form__group">
            <legend>Giấy tờ</legend>
            {VIA_API ? (
              <FormField label="CCCD nhà cung cấp" error={show('idCard')} hint="9–12 chữ số, không bắt buộc">
                <input {...text('idCard', { inputMode: 'numeric', maxLength: 12 })} />
              </FormField>
            ) : (
              <FormField label="Mã số thuế" error={show('taxCode')} hint="Không bắt buộc">
                <input {...text('taxCode', { maxLength: 14 })} />
              </FormField>
            )}
          </fieldset>
        </form>
      )}
    </Modal>
  );
}
