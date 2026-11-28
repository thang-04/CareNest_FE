import { useState } from 'react';
import { Phone, Save, ShieldCheck, UserRound } from '@/components/ui/icons';
import { StaffFormSection, StaffIdentityCard, StaffRolePicker, WorkCampusField } from '@/components/school-config/StaffAccountFormParts';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useMasterData } from '@/hooks/useMasterData';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { workCampusOptions } from '@/utils/school-config/schoolConfigPermissions';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StaffRoleReviewModal } from '@/components/school-config/StaffRoleReviewModal';
import { TextField } from '@/components/form/Field';
import { changeStaffAccountRole, updateStaffAccountProfile } from '@/services/school-config/schoolConfigService';
import {
  EMAIL_MAX,
  NAME_MAX,
  emailRequired,
  staffEditCampusId,
  staffRoleChangeRows,
  staffRoleChoices,
  toProfilePayload,
  toRoleChangePayload,
  validateStaffEdit,
} from '@/utils/school-config/staffImport';

/**
 * Sửa tài khoản nhân sự nối BE (AUTH-25): họ tên, email, vai trò; GV thêm cơ sở công tác (AUTH-15). Điểm trường của PHT /
 * bếp khi giữ nguyên vai trò, và trạng thái, đổi ở chức năng riêng.
 */
export function StaffAccountEditModal({ account, onClose }) {
  const toast = useToast();
  const { user } = useAuth();
  const md = useMasterData();
  const { roles, lockedReason } = staffRoleChoices(account, user);
  const [form, setForm] = useState({
    fullName: account.fullName || '',
    email: account.email || '',
    role: account.role,
    workCampusId: staffEditCampusId(account),
  });
  const roleChanged = form.role !== account.role;
  const showCampus = roleChanged || form.role === ROLES.TEACHER;
  // Cơ sở hiện tại của GV luôn có trong danh sách dù ngoài phạm vi chọn của người sửa
  const campuses = workCampusOptions(md.campuses, user);
  const currentCampus = md.campusById(form.workCampusId);
  const campusOptions =
    currentCampus && !campuses.some((c) => String(c.id) === String(currentCampus.id)) ? [currentCampus, ...campuses] : campuses;
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Hồ sơ lưu xong nhưng đổi vai trò lỗi: đóng modal vẫn phải tải lại danh sách
  const [profileSaved, setProfileSaved] = useState(false);
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    // Đổi vai trò làm đổi luật bắt buộc email và cơ sở ⇒ bỏ cả hai lỗi đang hiện
    const stale = ['_form', ...Object.keys(patch), ...('role' in patch ? ['email', 'workCampusId'] : [])];
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !stale.includes(k))));
  };
  const blur = (field) => {
    const e = validateStaffEdit(form, account.role);
    if (e[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };
  const close = () => onClose(profileSaved);
  const save = async () => {
    setSaving(true);
    let saved = false;
    try {
      // Lưu hồ sơ trước: email trùng thì dừng khi chưa kết thúc phân công nào
      const keepCampus = roleChanged ? account.workCampusId : undefined;
      await updateStaffAccountProfile(account.userId, toProfilePayload(form, account.role, keepCampus));
      saved = true;
      if (roleChanged) await changeStaffAccountRole(account.userId, toRoleChangePayload(form));
      toast.success(roleChanged ? `Đã đổi vai trò sang ${ROLE_LABELS[form.role]}.` : 'Đã lưu thông tin tài khoản.', form.fullName.trim());
      onClose(true);
    } catch (err) {
      if (saved) {
        setProfileSaved(true);
        setErrors({ ...err.details, _form: `Đã lưu thông tin, chưa đổi được vai trò: ${err.message}` });
      } else setErrors(err.details || { _form: err.message });
      setConfirming(false);
      setSaving(false);
    }
  };
  const submit = () => {
    const e = validateStaffEdit(form, account.role);
    setErrors(e);
    if (Object.keys(e).length) return;
    if (roleChanged) setConfirming(true);
    else save();
  };
  return (
    <Modal
      open
      size="lg"
      className="sc-account-modal"
      title="Sửa thông tin tài khoản"
      onClose={saving ? undefined : close}
      footer={
        <>
          <Button onClick={close} disabled={saving}>
            Hủy
          </Button>
          <Button variant="primary" icon={Save} loading={saving} onClick={submit}>
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
        <StaffFormSection
          icon={ShieldCheck}
          title="Vai trò"
          description={lockedReason || 'Đổi vai trò sẽ kết thúc các phân công đang hiệu lực.'}
        >
          {!lockedReason && <StaffRolePicker roles={roles} value={form.role} error={errors.role} onChange={(role) => set({ role })} />}
        </StaffFormSection>
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
            required={emailRequired(form.role)}
            error={errors.email}
            type="email"
            maxLength={EMAIL_MAX}
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            onBlur={() => blur('email')}
          />
          {showCampus && (
            <WorkCampusField
              campuses={roleChanged ? campuses : campusOptions}
              role={form.role}
              error={errors.workCampusId || errors.campusId}
              value={form.workCampusId}
              onChange={(workCampusId) => set({ workCampusId })}
              onBlur={() => blur('workCampusId')}
            />
          )}
        </StaffFormSection>
        <StaffFormSection icon={Phone} title="Đăng nhập" description="Trạng thái đổi ở chức năng riêng, không sửa ở đây.">
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
      {confirming && (
        <StaffRoleReviewModal
          name={account.fullName}
          rows={staffRoleChangeRows(account, form, currentCampus?.shortName || currentCampus?.name || '')}
          saving={saving}
          onConfirm={save}
          onClose={() => setConfirming(false)}
        />
      )}
    </Modal>
  );
}
