import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, Pencil, Save, X, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Avatar, Breadcrumb, ErrorState, FormField, LoadingState, Spinner } from '@/components';
import { useProfile } from '@/hooks/account/useAccount';
import { updateProfile } from '@/services/account/accountService';
import { validateProfile } from '@/utils/account/accountValidation';
import { canEditProfileField, canViewProfile } from '@/utils/account/accountPermissions';
import { acCrumbs } from '@/utils/account/breadcrumbs';
import { GENDER_LABELS } from '@/models/account/accountConstants';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { formatDate, formatDateTime } from '@/utils/format';
import '@/styles/modules/account.css';

const formFrom = (p) => ({ phone: p?.phone || '', dateOfBirth: p?.dateOfBirth || '', gender: p?.gender || '', address: p?.address || '' });

/** Screen 7 – User Profile (SRS 1.5): own details; contact fields are editable, school-managed fields are read-only. */
export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const { data: profile, loading, error, reload, setData } = useProfile({ live: !editing });
  const [form, setForm] = useState(formFrom(null));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const startEdit = () => {
    setForm(formFrom(profile));
    setErrors({});
    setEditing(true);
  };

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const blur = (field) => {
    const e = validateProfile(form);
    setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };

  const save = async (event) => {
    event.preventDefault();
    const e = validateProfile(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const updated = await updateProfile(form, user);
      setData(updated);
      setEditing(false);
      // Header shows name / phone from the auth context; refresh it when the context supports it.
      await refreshUser?.();
      toast.success('Đã lưu thông tin hồ sơ');
    } catch (err) {
      if (err.details && typeof err.details === 'object') setErrors(err.details);
      toast.error(err.message, 'Không lưu được hồ sơ');
    } finally {
      setBusy(false);
    }
  };

  const crumbs = acCrumbs('Hồ sơ cá nhân');

  if (loading && !profile) {
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <h1 className="page__title">Hồ sơ cá nhân</h1>
        <LoadingState />
      </div>
    );
  }

  if (error || !canViewProfile(profile, user)) {
    return (
      <div className="page">
        <Breadcrumb items={crumbs} />
        <h1 className="page__title">Hồ sơ cá nhân</h1>
        <div className="card">
          <ErrorState error={error || { message: 'Hiện chưa tải được hồ sơ của bạn. Vui lòng thử lại sau.' }} onRetry={reload} />
        </div>
      </div>
    );
  }

  const scope = profile.scope || {};

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <h1 className="page__title">Hồ sơ cá nhân</h1>
        {!editing && (
          <div className="row ac-head-actions">
            <Link to="/account/password" state={{ from: '/account/profile' }} className="btn">
              <KeyRound size={16} /> Đổi mật khẩu
            </Link>
            <button type="button" className="btn btn--primary" onClick={startEdit}>
              <Pencil size={16} /> Cập nhật hồ sơ
            </button>
          </div>
        )}
      </div>

      <div className="card ac-identity">
        <div className="card__body ac-identity__body">
          <Avatar user={profile} size="lg" />
          <div className="ac-identity__text">
            <div className="ac-identity__name">{profile.fullName}</div>
            <div className="row ac-identity__meta">
              <span className="chip chip--teal">{ROLE_LABELS[profile.role] || profile.role}</span>
              <span className="muted text-sm">{profile.email}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 ac-grid mt-16">
        <form className="card" onSubmit={save} noValidate>
          <div className="card__header">
            <h2 className="card__title">Thông tin liên hệ</h2>
          </div>
          <div className="card__body">
            {editing ? (
              <div className="stack ac-form">
                <FormField
                  label="Số điện thoại"
                  required
                  error={errors.phone}
                  hint="Dùng để nhà trường liên hệ và nhận mã xác thực trên ứng dụng"
                >
                  <input
                    className="input"
                    type="tel"
                    autoComplete="tel"
                    placeholder="0912 345 678"
                    value={form.phone}
                    disabled={!canEditProfileField('phone', user)}
                    onChange={(e) => set({ phone: e.target.value })}
                    onBlur={() => blur('phone')}
                  />
                </FormField>
                <FormField label="Ngày sinh" error={errors.dateOfBirth}>
                  <input
                    className="input"
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => set({ dateOfBirth: e.target.value })}
                    onBlur={() => blur('dateOfBirth')}
                  />
                </FormField>
                <FormField label="Giới tính" error={errors.gender}>
                  <select className="select" value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
                    <option value="">Chưa chọn</option>
                    {Object.entries(GENDER_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Địa chỉ" error={errors.address}>
                  <textarea
                    className="textarea"
                    rows={3}
                    maxLength={255}
                    value={form.address}
                    onChange={(e) => set({ address: e.target.value })}
                    onBlur={() => blur('address')}
                  />
                </FormField>
                <div className="page-actions ac-actions">
                  <button type="button" className="btn" onClick={() => setEditing(false)} disabled={busy}>
                    <X size={16} /> Hủy
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={busy}>
                    {busy ? <Spinner small /> : <Save size={16} />} {busy ? 'Đang lưu...' : 'Lưu hồ sơ'}
                  </button>
                </div>
              </div>
            ) : (
              <dl className="info-list">
                <dt>Số điện thoại</dt>
                <dd>{profile.phone || '—'}</dd>
                <dt>Ngày sinh</dt>
                <dd>{profile.dateOfBirth ? formatDate(profile.dateOfBirth) : '—'}</dd>
                <dt>Giới tính</dt>
                <dd>{GENDER_LABELS[profile.gender] || '—'}</dd>
                <dt>Địa chỉ</dt>
                <dd>{profile.address || '—'}</dd>
              </dl>
            )}
          </div>
        </form>

        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Tài khoản và phạm vi công việc</h2>
          </div>
          <div className="card__body">
            <dl className="info-list">
              <dt>Họ và tên</dt>
              <dd>{profile.fullName}</dd>
              <dt>Email đăng nhập</dt>
              <dd>{profile.email}</dd>
              <dt>Vai trò</dt>
              <dd>{ROLE_LABELS[profile.role] || profile.role}</dd>
              <dt>Điểm trường</dt>
              <dd>{profile.role === ROLES.PRINCIPAL ? 'Toàn trường' : scope.campusName || '—'}</dd>
              {scope.ageGroupName && (
                <>
                  <dt>Nhóm tuổi</dt>
                  <dd>{scope.ageGroupName}</dd>
                </>
              )}
              {scope.className && (
                <>
                  <dt>Lớp phụ trách</dt>
                  <dd>{scope.className}</dd>
                </>
              )}
              <dt>Đổi mật khẩu gần nhất</dt>
              <dd>{profile.passwordChangedAt ? formatDateTime(profile.passwordChangedAt) : 'Chưa đổi'}</dd>
            </dl>
            <div className="alert alert--info mt-16">
              <Info size={18} />
              <div>
                Họ tên, email, vai trò và phạm vi công việc do nhà trường quản lý. Cần chỉnh sửa, vui lòng liên hệ văn phòng nhà trường.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
