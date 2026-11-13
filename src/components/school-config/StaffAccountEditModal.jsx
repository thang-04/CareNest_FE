import { useState } from 'react';
import { Save } from '@/components/ui/icons';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/form/Field';
import { ROLE_LABELS } from '@/models/User';
import { updateStaffAccountProfile } from '@/services/school-config/schoolConfigService';
import { EMAIL_MAX, NAME_MAX, emailRequired, toProfilePayload, validateStaffProfile } from '@/utils/school-config/staffImport';

/** Sửa thông tin tài khoản nhân sự nối BE (AUTH-25): họ tên, email. Vai trò, điểm trường, trạng thái đổi ở chức năng riêng. */
export function StaffAccountEditModal({ account, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({ fullName: account.fullName || '', email: account.email || '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch) && k !== '_form')));
  };
  const blur = (field) => {
    const e = validateStaffProfile(form, account.role);
    if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };
  const save = async () => {
    const e = validateStaffProfile(form, account.role);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await updateStaffAccountProfile(account.userId, toProfilePayload(form));
      toast.success('Đã lưu thông tin tài khoản.', form.fullName.trim());
      onClose(true);
    } catch (err) {
      setErrors(err.details || { _form: err.message });
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      title={`Sửa thông tin ${account.fullName}`}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <Button onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </Button>
          <Button variant="primary" icon={Save} loading={saving} onClick={save}>
            Lưu thay đổi
          </Button>
        </>
      }
    >
      {errors._form && (
        <div className="alert alert--danger mb-12" role="alert">
          {errors._form}
        </div>
      )}
      <p className="text-sm text-2 mb-12">{ROLE_LABELS[account.role]}. Vai trò, điểm trường và trạng thái không đổi ở đây.</p>
      <div className="grid-2">
        <TextField
          label="Họ tên"
          required
          error={errors.fullName}
          maxLength={NAME_MAX}
          value={form.fullName}
          onChange={(e) => set({ fullName: e.target.value })}
          onBlur={() => blur('fullName')}
        />
        <TextField
          label="Email"
          required={emailRequired(account.role)}
          error={errors.email}
          type="email"
          maxLength={EMAIL_MAX}
          value={form.email}
          onChange={(e) => set({ email: e.target.value })}
          onBlur={() => blur('email')}
        />
        <TextField
          label="Số điện thoại (tên đăng nhập)"
          hint="Số điện thoại là tên đăng nhập nên không sửa ở đây."
          type="tel"
          value={account.phone || ''}
          disabled
          readOnly
        />
      </div>
    </Modal>
  );
}
