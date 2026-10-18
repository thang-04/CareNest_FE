import { useId, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Info, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useStaffStructure } from '@/hooks/account/useStaff';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { FormField } from '@/components/form/FormField';
import { Modal } from '@/components/ui/Modal';
import { PeopleTabs } from '@/components/account/PeopleTabs';
import { createAccount } from '@/services/account/staffService';
import { PERMISSION_ROLE_LABELS } from '@/models/account/permissionConstants';
import { assignmentTargetOf, hasErrors, validateStaffAccount } from '@/utils/account/staffValidation';
import { staffCrumbs } from '@/utils/school-config/breadcrumbs';
import '@/styles/modules/school-config.css';

const EMPTY = { username: '', fullName: '', email: '', role: '', temporaryPassword: '', campusId: '', classroomId: '', validFrom: '' };

export default function StaffFormPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialValues = {
    role: params.get('role') || '',
    campusId: params.get('campusId') || '',
    classroomId: params.get('classroomId') || '',
  };

  return (
    <div className="page">
      <Breadcrumb items={staffCrumbs('Tạo tài khoản')} />
      <PeopleTabs />
      <StaffFormModal
        initialValues={initialValues}
        onClose={() => navigate('/school/staff')}
        onCreated={(account) => navigate(`/school/staff/${account.userId}`)}
      />
    </div>
  );
}

export function StaffFormModal({ initialValues = {}, onClose, onCreated }) {
  const formId = useId();
  const { user, hasRole } = useAuth();
  const toast = useToast();
  const structure = useStaffStructure();
  const wholeSchool = hasRole('PRINCIPAL');
  const roles = wholeSchool ? ['VICE_PRINCIPAL', 'TEACHER', 'KITCHEN_STAFF'] : ['TEACHER', 'KITCHEN_STAFF'];
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...initialValues,
    role: roles.includes(initialValues.role) ? initialValues.role : '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const target = assignmentTargetOf(form.role);
  const classrooms = useMemo(
    () => structure.classrooms.filter((classroom) => !form.campusId || String(classroom.campusId) === String(form.campusId)),
    [structure.classrooms, form.campusId],
  );

  const set = (patch) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors((current) => {
      const next = { ...current };
      Object.keys(patch).forEach((key) => delete next[key]);
      return next;
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validateStaffAccount(form, { assignmentRequired: !wholeSchool });
    setErrors(found);
    if (hasErrors(found)) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        campusId: target === 'campus' ? form.campusId : '',
        classroomId: target === 'classroom' ? form.classroomId : '',
      };
      const created = await createAccount(payload, user);
      toast.success(
        form.temporaryPassword ? 'Hãy giao mật khẩu tạm cho người dùng; họ phải đổi ở lần đăng nhập đầu.' : 'Đã gửi email đặt mật khẩu.',
        'Đã tạo tài khoản',
      );
      onCreated?.(created);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không tạo được tài khoản');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      size="lg"
      title="Thêm nhân sự"
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <button className="btn" type="button" disabled={saving} onClick={onClose}>
            Hủy
          </button>
          <button className="btn btn--primary" type="submit" form={formId} disabled={saving}>
            <Save size={16} /> Tạo tài khoản
          </button>
        </>
      }
    >
      <div className="alert alert--info mb-16">
        <Info size={18} />
        <div>
          {wholeSchool
            ? 'Có thể phân công ngay hoặc phân công sau trong hồ sơ nhân sự.'
            : 'Phó hiệu trưởng phải phân công ngay vào điểm trường mình phụ trách.'}{' '}
          Tài khoản Hiệu trưởng do Quản trị hệ thống tạo; tài khoản phụ huynh tạo từ hồ sơ trẻ.
        </div>
      </div>
      <form id={formId} onSubmit={submit} noValidate>
        <div className="grid-2">
          <FormField label="Họ tên" required error={errors.fullName}>
            <input className="input" value={form.fullName} maxLength={150} onChange={(event) => set({ fullName: event.target.value })} />
          </FormField>
          <FormField label="Tên đăng nhập" required error={errors.username} hint="Chữ, số, dấu . _ -">
            <input className="input" value={form.username} maxLength={100} onChange={(event) => set({ username: event.target.value })} />
          </FormField>
          <FormField label="Email" error={errors.email} hint="Có email ⇒ hệ thống có thể gửi thư đặt mật khẩu">
            <input
              className="input"
              type="email"
              value={form.email}
              maxLength={255}
              onChange={(event) => set({ email: event.target.value })}
            />
          </FormField>
          <FormField
            label="Mật khẩu tạm"
            required={!form.email}
            error={errors.temporaryPassword}
            hint="8–128 ký tự, bắt đổi ở lần đăng nhập đầu"
          >
            <input
              className="input"
              type="password"
              autoComplete="new-password"
              value={form.temporaryPassword}
              maxLength={128}
              onChange={(event) => set({ temporaryPassword: event.target.value })} // carenest:allow-secret
            />
          </FormField>
          <FormField label="Vai trò" required error={errors.role}>
            <select className="select" value={form.role} onChange={(event) => set({ role: event.target.value, classroomId: '' })}>
              <option value="">Chọn vai trò</option>
              {roles.map((role) => (
                <option key={role} value={role}>
                  {PERMISSION_ROLE_LABELS[role]}
                </option>
              ))}
            </select>
          </FormField>
          {target && (
            <FormField label="Điểm trường" required={!wholeSchool || target === 'campus'} error={errors.campusId}>
              <select className="select" value={form.campusId} onChange={(event) => set({ campusId: event.target.value, classroomId: '' })}>
                <option value="">{wholeSchool ? 'Chưa phân công' : 'Chọn điểm trường'}</option>
                {structure.campuses.map((campus) => (
                  <option key={campus.id} value={campus.id}>
                    {campus.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          {target === 'classroom' && (
            <FormField label="Lớp" required={!wholeSchool} error={errors.classroomId}>
              <select className="select" value={form.classroomId} onChange={(event) => set({ classroomId: event.target.value })}>
                <option value="">{wholeSchool ? 'Chưa phân công' : 'Chọn lớp'}</option>
                {classrooms.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          {target && (form.campusId || form.classroomId) && (
            <FormField label="Phân công từ ngày" hint="Bỏ trống = hôm nay">
              <input className="input" type="date" value={form.validFrom} onChange={(event) => set({ validFrom: event.target.value })} />
            </FormField>
          )}
        </div>
      </form>
    </Modal>
  );
}
