import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AtSign,
  Briefcase,
  Building,
  Cake,
  Gender,
  IdCard,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Pencil,
  PencilLine,
  Phone,
  Save,
  School,
  ShieldCheck,
  X,
} from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Avatar, Breadcrumb, ErrorState, FormField, LoadingState, Spinner } from '@/components';
import { useProfile } from '@/hooks/account/useAccount';
import { updateProfile } from '@/services/account/accountService';
import { validateProfile } from '@/utils/account/accountValidation';
import { canEditProfileField, canViewProfile } from '@/utils/account/accountPermissions';
import { acCrumbs } from '@/utils/account/breadcrumbs';
import { GENDER_LABELS, STAFF_ROLE_LABELS } from '@/models/account/accountConstants';
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
  const roleLabel = ROLE_LABELS[profile.role] || profile.role;
  const workplace = profile.role === ROLES.PRINCIPAL ? 'Toàn trường' : scope.campusName;
  const assignments = profile.assignments || [];
  const empty = <span className="ac-empty">Chưa cập nhật</span>;

  return (
    <div className="page">
      <Breadcrumb items={crumbs} />
      <div className="page__head">
        <h1 className="page__title">Hồ sơ cá nhân</h1>
      </div>

      <div className="ac-profile">
        {/* Cột trái: là ai, phụ trách đâu, liên hệ nhanh và hai việc chính */}
        <aside className="card ac-side">
          <div className="ac-side__top">
            <Avatar user={profile} size="2xl" />
            <div className="ac-side__name">{profile.fullName}</div>
            <span className="chip chip--teal">
              <School size={14} /> {roleLabel}
            </span>
          </div>
          <ul className="ac-side__facts">
            {(scope.className || workplace) && (
              <li>
                <Building size={16} />
                <span>{[scope.className, workplace].filter(Boolean).join(' · ')}</span>
              </li>
            )}
            <li>
              <Mail size={16} />
              <span>{profile.email}</span>
            </li>
            <li>
              <Phone size={16} />
              <span>{profile.phone || empty}</span>
            </li>
            {profile.username && (
              <li>
                <AtSign size={16} />
                <span>{profile.username}</span>
              </li>
            )}
          </ul>
          {!editing && (
            <div className="ac-side__actions">
              <button type="button" className="btn btn--primary" onClick={startEdit}>
                <Pencil size={16} /> Cập nhật hồ sơ
              </button>
              <Link to="/account/password" state={{ from: '/account/profile' }} className="btn">
                <KeyRound size={16} /> Đổi mật khẩu
              </Link>
            </div>
          )}
        </aside>

        <div className="ac-main">
          <form className="card" onSubmit={save} noValidate>
            <div className="card__header">
              <h2 className="card__title">
                <span className="ac-title-icon">
                  <IdCard size={17} />
                </span>
                Thông tin cá nhân và liên hệ
              </h2>
              {!editing && (
                <span className="ac-owner">
                  <PencilLine size={13} /> Bạn tự cập nhật
                </span>
              )}
            </div>
            <div className="card__body">
              {editing ? (
                <div className="ac-form-grid">
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
                  <fieldset className="ac-span-2 ac-choice">
                    <legend className="ac-choice__legend">Giới tính</legend>
                    {[...Object.entries(GENDER_LABELS), ['', 'Chưa chọn']].map(([value, label]) => (
                      <label key={value || 'none'} className={`ac-choice__item ${form.gender === value ? 'is-on' : ''}`}>
                        <input
                          type="radio"
                          name="gender"
                          value={value}
                          checked={form.gender === value}
                          onChange={() => set({ gender: value })}
                        />
                        {label}
                      </label>
                    ))}
                    {errors.gender && <span className="ac-choice__error">{errors.gender}</span>}
                  </fieldset>
                  <div className="ac-span-2">
                    <FormField label="Địa chỉ" error={errors.address}>
                      <textarea
                        className="textarea"
                        rows={2}
                        maxLength={255}
                        value={form.address}
                        onChange={(e) => set({ address: e.target.value })}
                        onBlur={() => blur('address')}
                      />
                    </FormField>
                  </div>
                  <div className="page-actions ac-actions ac-span-2">
                    <button type="button" className="btn" onClick={() => setEditing(false)} disabled={busy}>
                      <X size={16} /> Hủy
                    </button>
                    <button type="submit" className="btn btn--primary" disabled={busy}>
                      {busy ? <Spinner small /> : <Save size={16} />} {busy ? 'Đang lưu...' : 'Lưu hồ sơ'}
                    </button>
                  </div>
                </div>
              ) : (
                <dl className="ac-dl">
                  <div>
                    <dt>
                      <Cake size={14} /> Ngày sinh
                    </dt>
                    <dd>{profile.dateOfBirth ? formatDate(profile.dateOfBirth) : empty}</dd>
                  </div>
                  <div>
                    <dt>
                      <Gender size={14} /> Giới tính
                    </dt>
                    <dd>{GENDER_LABELS[profile.gender] || empty}</dd>
                  </div>
                  <div>
                    <dt>
                      <Phone size={14} /> Số điện thoại
                    </dt>
                    <dd>{profile.phone || empty}</dd>
                  </div>
                  <div>
                    <dt>
                      <MapPin size={14} /> Địa chỉ
                    </dt>
                    <dd>{profile.address || empty}</dd>
                  </div>
                </dl>
              )}
            </div>
          </form>

          <section className="card">
            <div className="card__header">
              <h2 className="card__title">
                <span className="ac-title-icon">
                  <Briefcase size={17} />
                </span>
                Công việc
              </h2>
              <span className="ac-owner">
                <Lock size={13} /> Nhà trường quản lý
              </span>
            </div>
            <div className="card__body">
              <dl className="ac-dl ac-dl--1">
                <div>
                  <dt>Vai trò</dt>
                  <dd>{roleLabel}</dd>
                </div>
                <div>
                  <dt>Điểm trường</dt>
                  <dd>{workplace || empty}</dd>
                </div>
                {(scope.ageGroupName || scope.className) && (
                  <div>
                    <dt>Nhóm tuổi · lớp phụ trách</dt>
                    <dd>{[scope.ageGroupName, scope.className].filter(Boolean).join(' · ')}</dd>
                  </div>
                )}
              </dl>
              <div className="ac-eyebrow">Phân công đang hiệu lực</div>
              {assignments.length ? (
                <ul className="ac-assign">
                  {assignments.map((a) => (
                    <li key={a.key}>
                      <span className="ac-assign__dot" aria-hidden="true" />
                      <span className="ac-assign__title">
                        {[STAFF_ROLE_LABELS[a.staffRole] || a.staffRole, a.className].filter(Boolean).join(' · ')}
                      </span>
                      <span className="ac-assign__meta">
                        {a.campusName && <span>{a.campusName}</span>}
                        {a.validFrom && (
                          <span>
                            {formatDate(a.validFrom)} – {a.validTo ? formatDate(a.validTo) : 'chưa có ngày kết thúc'}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ac-muted">Chưa có phân công trong năm học hiện tại.</p>
              )}
              <p className="ac-muted">Cần sửa vai trò hoặc phân công, liên hệ văn phòng nhà trường.</p>
            </div>
          </section>

          <section className="card">
            <div className="card__header">
              <h2 className="card__title">
                <span className="ac-title-icon">
                  <ShieldCheck size={17} />
                </span>
                Đăng nhập và bảo mật
              </h2>
            </div>
            <div className="card__body">
              <dl className="ac-dl ac-dl--1">
                {profile.username && (
                  <div>
                    <dt>Tên đăng nhập</dt>
                    <dd>{profile.username}</dd>
                  </div>
                )}
                <div>
                  <dt>Email đăng nhập</dt>
                  <dd>{profile.email}</dd>
                </div>
                <div>
                  <dt>Đổi mật khẩu gần nhất</dt>
                  <dd>
                    {profile.passwordChangedAt ? (
                      formatDateTime(profile.passwordChangedAt)
                    ) : (
                      <span className="ac-empty">Chưa đổi lần nào</span>
                    )}
                  </dd>
                </div>
              </dl>
              <Link to="/account/password" state={{ from: '/account/profile' }} className="btn btn--sm mt-16">
                <KeyRound size={16} /> Đổi mật khẩu
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
