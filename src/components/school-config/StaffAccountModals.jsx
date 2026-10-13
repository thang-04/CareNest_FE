import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Info, Save } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/States';
import { FormField } from '@/components/form/FormField';
import { getStaffImpact, saveStaffAccount, setStaffStatus, updateStaffProfile } from '@/services/school-config/schoolConfigService';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { STAFF_ROLE_OPTIONS, validateStaffAccount, validateStaffProfile, hasErrors } from '@/utils/school-config/schoolConfigValidation';
import { DateInput } from '@/components/form/DateInput';

const baseRole = (role) => (role === ROLES.TEAM_LEADER ? ROLES.TEACHER : role);
const EMPTY = { fullName: '', email: '', phone: '', role: ROLES.TEACHER, campusId: '', reason: '' };

/** Danh sách phân công sẽ kết thúc khi đổi vai trò / điểm trường / vô hiệu hóa (lấy từ repository). */
function ImpactList({ items, loading }) {
  if (loading)
    return (
      <div className="mt-12">
        <Spinner small /> Đang kiểm tra phân công hiện tại…
      </div>
    );
  if (!items) return null;
  return (
    <div className={`alert ${items.length ? 'alert--warning' : 'alert--info'} mt-12`}>
      {items.length ? <AlertTriangle size={18} /> : <Info size={18} />}
      <div>
        {items.length ? (
          <>
            <b>Các phân công sau sẽ kết thúc ngay hôm nay</b> (lịch sử vẫn giữ):
            <ul className="sc-reasons">
              {items.map((it, i) => (
                <li key={i}>{it.text}</li>
              ))}
            </ul>
          </>
        ) : (
          'Không có phân công nào bị ảnh hưởng.'
        )}
      </div>
    </div>
  );
}

/** Create / edit a staff account. Changing role or campus lists the assignments it ends and asks for a reason. */
export function StaffFormModal({ account, campuses, existing, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() =>
    account
      ? { ...EMPTY, ...account, role: baseRole(account.role), campusId: account.campusId || '', phone: account.phone || '', reason: '' }
      : EMPTY,
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [impact, setImpact] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saved, setSaved] = useState(null);

  const changed = !!account && (baseRole(account.role) !== form.role || (account.campusId || '') !== form.campusId);

  useEffect(() => {
    if (!changed) {
      setImpact(null);
      return undefined;
    }
    let alive = true;
    setChecking(true);
    getStaffImpact(account.id, { role: form.role, campusId: form.campusId, status: account.status }, user)
      .then((items) => alive && setImpact(items))
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, [changed, form.role, form.campusId, account, user]);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const submit = async () => {
    const e = validateStaffAccount(
      form,
      existing.filter((u) => u.id !== account?.id),
    );
    if (changed && !form.reason.trim()) e.reason = 'Nhập lý do đổi vai trò / điểm trường';
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      const result = await saveStaffAccount(account?.id || null, form, user);
      toast.success(
        changed || !account ? `${result.fullName} đã được thông báo.` : 'Đã lưu thay đổi.',
        account ? 'Cập nhật tài khoản' : 'Tạo tài khoản',
      );
      // Lên Phó hiệu trưởng: gợi ý phân công điểm trường và quyền theo mảng
      if (form.role === ROLES.VICE_PRINCIPAL && (changed || !account)) setSaved(result);
      else onClose(true);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được thay đổi');
    } finally {
      setSaving(false);
    }
  };

  if (saved)
    return (
      <Modal open title="Đã lưu tài khoản" onClose={() => onClose(true)}>
        <p>
          <b>{saved.fullName}</b> giờ là Phó hiệu trưởng
          {saved.campusId ? ` phụ trách ${campuses.find((c) => c.id === saved.campusId)?.shortName}` : ' (chưa có điểm trường)'}.
        </p>
        <p className="text-sm text-2">
          {saved.campusId
            ? 'Quyền theo mảng đang theo mặc định của vai trò. Đặt quyền riêng (thực đơn, phân công giáo viên, CSVC) ở màn Phân công Phó hiệu trưởng.'
            : 'Chưa có điểm trường nên chưa thấy dữ liệu theo điểm trường. Hãy phân công điểm trường và quyền ở màn Phân công Phó hiệu trưởng.'}
        </p>
        <div className="row row--wrap mt-12">
          <Link className="btn btn--primary" to="/school/vice-principals">
            Mở Phân công Phó hiệu trưởng
          </Link>
          <button className="btn" onClick={() => onClose(true)}>
            Để sau
          </button>
        </div>
      </Modal>
    );

  return (
    <Modal
      open
      size="lg"
      title={account ? `Sửa tài khoản ${account.fullName}` : 'Thêm tài khoản nhân sự'}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={saving || checking}>
            {saving ? <Spinner small /> : <Save size={16} />} {changed ? 'Xác nhận đổi và lưu' : 'Lưu tài khoản'}
          </button>
        </>
      }
    >
      <div className="grid-2">
        <FormField label="Họ tên" required error={errors.fullName}>
          <input className="input" value={form.fullName} maxLength={100} onChange={(e) => set({ fullName: e.target.value })} />
        </FormField>
        <FormField label="Email đăng nhập" required error={errors.email}>
          <input className="input" type="email" value={form.email} maxLength={120} onChange={(e) => set({ email: e.target.value })} />
        </FormField>
        <FormField label="Số điện thoại" error={errors.phone}>
          <input className="input" value={form.phone} maxLength={20} onChange={(e) => set({ phone: e.target.value })} />
        </FormField>
        <FormField label="Vai trò" required error={errors.role} hint="Tổ trưởng là giáo viên được giao nhóm tuổi (Phân công giáo viên)">
          <select className="select" value={form.role} onChange={(e) => set({ role: e.target.value })}>
            {STAFF_ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField
          label="Điểm trường"
          required={form.role !== ROLES.VICE_PRINCIPAL}
          error={errors.campusId}
          hint={form.role === ROLES.VICE_PRINCIPAL ? 'Có thể để trống và phân công sau ở màn Phân công Phó hiệu trưởng' : undefined}
        >
          <select className="select" value={form.campusId} onChange={(e) => set({ campusId: e.target.value })}>
            <option value="">{form.role === ROLES.VICE_PRINCIPAL ? 'Chưa chọn' : 'Chọn điểm trường'}</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName || c.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      {changed && (
        <>
          <ImpactList items={impact} loading={checking} />
          <FormField label="Lý do đổi" required error={errors.reason} className="mt-12">
            <textarea className="textarea" rows={2} maxLength={300} value={form.reason} onChange={(e) => set({ reason: e.target.value })} />
          </FormField>
          <p className="text-xs muted mt-8">Thay đổi có hiệu lực từ lần đăng nhập tiếp theo của người này; người này nhận thông báo.</p>
        </>
      )}
      {!account && (
        <p className="text-xs muted mt-12">
          Hệ thống gửi email để người dùng đặt mật khẩu lần đầu (BE). Bản demo: đăng nhập bằng mật khẩu demo rồi đổi mật khẩu.
        </p>
      )}
    </Modal>
  );
}

/** Deactivate / reactivate: deactivating lists and ends the active assignments; data the person created stays. */
export function StaffStatusModal({ account, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const deactivate = (account.status || 'ACTIVE') === 'ACTIVE';
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [impact, setImpact] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!deactivate) return;
    getStaffImpact(account.id, { role: account.role, campusId: account.campusId, status: 'INACTIVE' }, user).then(setImpact);
  }, [deactivate, account, user]);

  const submit = async () => {
    if (!reason.trim()) return setError('Nhập lý do');
    setSaving(true);
    try {
      await setStaffStatus(account.id, deactivate ? 'INACTIVE' : 'ACTIVE', reason, user);
      toast.success(deactivate ? 'Đã vô hiệu hóa tài khoản.' : 'Đã kích hoạt lại tài khoản.', account.fullName);
      onClose(true);
    } catch (err) {
      toast.error(err.message, 'Không lưu được thay đổi');
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      open
      title={deactivate ? `Vô hiệu hóa ${account.fullName}` : `Kích hoạt lại ${account.fullName}`}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button
            className={`btn ${deactivate ? 'btn--danger' : 'btn--primary'}`}
            onClick={submit}
            disabled={saving || (deactivate && !impact)}
          >
            {saving && <Spinner small />} {deactivate ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
          </button>
        </>
      }
    >
      <p className="text-sm text-2">
        {deactivate
          ? 'Người này sẽ không đăng nhập được nữa. Dữ liệu đã tạo (điểm danh, đánh giá, phiếu…) giữ nguyên, không xóa.'
          : 'Người này đăng nhập lại được. Phân công đã kết thúc trước đó không tự khôi phục: hãy phân công lại.'}
      </p>
      {deactivate && <ImpactList items={impact} loading={!impact} />}
      <FormField label="Lý do" required error={error} className="mt-12">
        <textarea
          className="textarea"
          rows={2}
          maxLength={300}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setError('');
          }}
        />
      </FormField>
    </Modal>
  );
}

/** PHT được giao "Hồ sơ nhân sự · Được sửa": chỉ sửa thông tin hồ sơ, không đổi vai trò / điểm trường / trạng thái. */
export function StaffProfileModal({ account, existing, onClose }) {
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    fullName: account.fullName || '',
    email: account.email || '',
    phone: account.phone || '',
    dateOfBirth: account.dateOfBirth || '',
    qualification: account.qualification || '',
    note: account.note || '',
  }));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !(k in patch))));
  };
  const submit = async () => {
    const e = validateStaffProfile(
      form,
      existing.filter((u) => u.id !== account.id),
    );
    setErrors(e);
    if (hasErrors(e)) return;
    setSaving(true);
    try {
      await updateStaffProfile(account.id, form, user);
      toast.success('Đã lưu thông tin hồ sơ.', account.fullName);
      onClose(true);
    } catch (err) {
      if (err.details) setErrors(err.details);
      toast.error(err.message, 'Không lưu được thay đổi');
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      title={`Sửa hồ sơ – ${account.fullName}`}
      onClose={saving ? undefined : () => onClose(false)}
      footer={
        <>
          <button className="btn" onClick={() => onClose(false)} disabled={saving}>
            Hủy
          </button>
          <button className="btn btn--primary" onClick={submit} disabled={saving}>
            {saving ? <Spinner small /> : <Save size={16} />} Lưu hồ sơ
          </button>
        </>
      }
    >
      <p className="text-sm text-2 mb-12">
        {ROLE_LABELS[account.role]}. Vai trò, điểm trường và trạng thái tài khoản do Hiệu trưởng thay đổi.
      </p>
      <div className="grid-2">
        <FormField label="Họ tên" required error={errors.fullName}>
          <input className="input" maxLength={100} value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} />
        </FormField>
        <FormField label="Email" required error={errors.email}>
          <input className="input" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </FormField>
        <FormField label="Số điện thoại" error={errors.phone}>
          <input className="input" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </FormField>
        <FormField label="Ngày sinh" error={errors.dateOfBirth}>
          <DateInput value={form.dateOfBirth} onChange={(v) => set({ dateOfBirth: v })} />
        </FormField>
      </div>
      <FormField label="Trình độ chuyên môn" error={errors.qualification} className="mt-12">
        <input
          className="input"
          maxLength={200}
          placeholder="Ví dụ: Cao đẳng Sư phạm Mầm non"
          value={form.qualification}
          onChange={(e) => set({ qualification: e.target.value })}
        />
      </FormField>
      <FormField label="Ghi chú" error={errors.note} className="mt-12">
        <textarea className="textarea" rows={2} maxLength={500} value={form.note} onChange={(e) => set({ note: e.target.value })} />
      </FormField>
    </Modal>
  );
}
