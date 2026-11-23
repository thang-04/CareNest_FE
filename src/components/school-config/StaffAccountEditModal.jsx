import { useState } from 'react';
import { Phone, Save, UserRound } from '@/components/ui/icons';
import { StaffFormSection, StaffIdentityCard, WorkCampusField } from '@/components/school-config/StaffAccountFormParts';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { ROLES } from '@/models/User';
import { workCampusOptions } from '@/utils/school-config/schoolConfigPermissions';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/form/Field';
import { updateStaffAccountProfile } from '@/services/school-config/schoolConfigService';
import { EMAIL_MAX, NAME_MAX, emailRequired, toProfilePayload, validateStaffEdit } from '@/utils/school-config/staffImport';

/**
 * Sửa thông tin tài khoản nhân sự nối BE (AUTH-25): họ tên, email; GV thêm cơ sở công tác (AUTH-15). Vai trò, phân công điểm
 * trường của PHT / bếp, trạng thái đổi ở chức năng riêng.
 */
export function StaffAccountEditModal({ account, onClose }) {
  const toast = useToast();
  const { user } = useAuth();
  const md = useMasterData();
  const teacher = account.role === ROLES.TEACHER;
  const [form, setForm] = useState({
    fullName: account.fullName || '',
    email: account.email || '',
    workCampusId: account.workCampusId ? String(account.workCampusId) : '',
  });
  // Cơ sở hiện tại của GV luôn có trong danh sách dù ngoài phạm vi chọn của người sửa
  const campuses = workCampusOptions(md.campuses, user);
  const currentCampus = md.campusById(form.workCampusId);
  const campusOptions =
    currentCampus && !campuses.some((c) => String(c.id) === String(currentCampus.id)) ? [currentCampus, ...campuses] : campuses;
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch) && k !== '_form')));
  };
  const blur = (field) => {
    const e = validateStaffEdit(form, account.role);
    if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };
  const save = async () => {
    const e = validateStaffEdit(form, account.role);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await updateStaffAccountProfile(account.userId, toProfilePayload(form, account.role));
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
      className="sc-account-modal"
      title="Sửa thông tin tài khoản"
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
      <div className="sc-account-form">
        {errors._form && (
          <div className="alert alert--danger" role="alert">
            {errors._form}
          </div>
        )}
        <StaffIdentityCard account={account} />
        <StaffFormSection icon={UserRound} title="Thông tin cá nhân">
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
          {teacher && (
            <WorkCampusField
              campuses={campusOptions}
              role={account.role}
              error={errors.workCampusId}
              value={form.workCampusId}
              onChange={(workCampusId) => set({ workCampusId })}
              onBlur={() => blur('workCampusId')}
            />
          )}
        </StaffFormSection>
        <StaffFormSection
          icon={Phone}
          title="Đăng nhập"
          description={
            teacher
              ? 'Vai trò và trạng thái đổi ở chức năng riêng, không sửa ở đây.'
              : 'Vai trò, điểm trường và trạng thái đổi ở chức năng riêng, không sửa ở đây.'
          }
        >
          <TextField
            label="Số điện thoại (tên đăng nhập)"
            hint="Số điện thoại là tên đăng nhập nên không sửa được."
            type="tel"
            value={account.phone || ''}
            disabled
            readOnly
          />
        </StaffFormSection>
      </div>
    </Modal>
  );
}
