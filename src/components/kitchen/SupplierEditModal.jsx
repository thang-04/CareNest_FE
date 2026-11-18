import { useEffect, useState } from 'react';
import { Building, IdCard, Phone, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useSupplier } from '@/hooks/kitchen/useKitchen';
import { useUnsavedMark } from '@/hooks/useLeaveGuard';
import { Button, ErrorState, FormField, LoadingState, Modal, TextField } from '@/components';
import { Tabs } from '@/components/ui/Tabs';
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

  // So với bản đã tải (sửa) hoặc mẫu trống (thêm); đang tải thì chưa tính. Đang lưu vẫn đánh dấu để lưu lỗi 401 không mất dữ liệu
  const baseline = existing.data ? pick(existing.data) : EMPTY;
  useUnsavedMark(!(supplierId && existing.loading) && Object.keys(EMPTY).some((k) => form[k] !== baseline[k]));

  const errors = { ...validateSupplier(form), ...serverErrors };
  const show = (k) => (submitted || touched[k] ? errors[k] : undefined);
  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    // Xóa hẳn khóa: để `undefined` thì spread vào errors sẽ đè mất lỗi kiểm tra của ô
    setServerErrors(({ [k]: _drop, ...rest }) => rest);
  };
  const blur = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const text = (k) => ({ value: form[k], onChange: (e) => set(k, e.target.value), onBlur: blur(k) });

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
  const statusTabs = Object.entries(SUPPLIER_STATUS_LABELS).map(([key, label]) => ({ key, label }));
  return (
    <Modal
      open
      size="lg"
      title={supplierId ? `Sửa nhà cung cấp${existing.data?.code ? ` · ${existing.data.code}` : ''}` : 'Thêm nhà cung cấp'}
      onClose={busy ? undefined : onClose}
      closeOnBackdrop={false}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" icon={Save} loading={busy} disabled={loading}>
            Lưu nhà cung cấp
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingState />
      ) : supplierId && existing.error ? (
        <ErrorState error={existing.error} onRetry={existing.reload} />
      ) : (
        <form id={FORM_ID} onSubmit={submit} noValidate className="kb-sup-form">
          <section className="kb-sup-sec">
            <header className="kb-sup-sec__head">
              <span className="kb-sup-sec__icon" aria-hidden="true">
                <Building size={18} />
              </span>
              <div>
                <h3 className="kb-sup-sec__title">Thông tin chung</h3>
                <p className="kb-sup-sec__desc">Tên hiện trên phiếu nhập và biểu mẫu kiểm thực.</p>
              </div>
            </header>
            <div className="kb-sup-sec__fields">
              <TextField
                label="Tên nhà cung cấp"
                required
                fieldClassName="kb-span-all"
                maxLength={150}
                error={show('name')}
                {...text('name')}
              />
              <FormField
                label="Trạng thái"
                className="kb-span-all"
                hint={
                  form.status === SUPPLIER_STATUS.INACTIVE
                    ? 'Không chọn được cho phiếu nhập mới; phiếu cũ vẫn giữ tên.'
                    : 'Chọn được khi lập phiếu nhập.'
                }
              >
                <Tabs
                  items={statusTabs}
                  value={form.status}
                  onChange={(v) => set('status', v)}
                  ariaLabel="Trạng thái nhà cung cấp"
                  variant="pill"
                />
              </FormField>
            </div>
          </section>
          <section className="kb-sup-sec">
            <header className="kb-sup-sec__head">
              <span className="kb-sup-sec__icon" aria-hidden="true">
                <Phone size={18} />
              </span>
              <div>
                <h3 className="kb-sup-sec__title">Liên hệ</h3>
                <p className="kb-sup-sec__desc">Bếp gọi khi cần đổi, bù hoặc trả hàng.</p>
              </div>
            </header>
            <div className="kb-sup-sec__fields">
              <TextField
                label={VIA_API ? 'Người giao hàng' : 'Người liên hệ'}
                maxLength={100}
                error={show('contactName')}
                {...text('contactName')}
              />
              <TextField
                label="Số điện thoại"
                type="tel"
                inputMode="tel"
                maxLength={20}
                placeholder="0900 000 001"
                error={show('phone')}
                {...text('phone')}
              />
              <TextField label="Địa chỉ" fieldClassName="kb-span-all" maxLength={255} error={show('address')} {...text('address')} />
            </div>
          </section>
          <section className="kb-sup-sec">
            <header className="kb-sup-sec__head">
              <span className="kb-sup-sec__icon" aria-hidden="true">
                <IdCard size={18} />
              </span>
              <div>
                <h3 className="kb-sup-sec__title">Giấy tờ</h3>
                <p className="kb-sup-sec__desc">Không bắt buộc.</p>
              </div>
            </header>
            <div className="kb-sup-sec__fields">
              {VIA_API ? (
                <TextField
                  label="CCCD nhà cung cấp"
                  inputMode="numeric"
                  maxLength={12}
                  hint="9–12 chữ số"
                  error={show('idCard')}
                  {...text('idCard')}
                />
              ) : (
                <TextField label="Mã số thuế" maxLength={14} error={show('taxCode')} {...text('taxCode')} />
              )}
            </div>
          </section>
        </form>
      )}
    </Modal>
  );
}
