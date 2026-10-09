import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Info, KeyRound } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Breadcrumb, FormField, PasswordInput, Spinner } from '@/components';
import { NewPasswordFields } from '@/components/account/NewPasswordFields';
import { changePassword } from '@/services/account/accountService';
import { validatePasswordChange } from '@/utils/account/accountValidation';
import { acCrumbs } from '@/utils/account/breadcrumbs';
import '@/styles/modules/account.css';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

/** Screen 6 – Password Change (SRS 1.2) for a signed-in user. */
export default function ChangePasswordPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = location.state?.from || '/account/profile';
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const onCurrentChange = (e) => change({ currentPassword: e.target.value }); // carenest:allow-secret – tên field

  const change = (patch) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
    setServerError('');
  };

  const blur = (field) => {
    if (!values[field]) return;
    const e = validatePasswordChange(values, { requireCurrent: true });
    setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const e = validatePasswordChange(values, { requireCurrent: true });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await changePassword(values, user);
      setValues(EMPTY);
      toast.success('Mật khẩu của bạn đã được thay đổi thành công.');
      navigate(backTo, { replace: true });
    } catch (err) {
      if (err.details && typeof err.details === 'object') setErrors(err.details);
      else setServerError(err.message || 'Chưa đổi được mật khẩu. Vui lòng thử lại.');
      setValues((v) => ({ ...v, currentPassword: '' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Breadcrumb items={acCrumbs({ label: 'Hồ sơ cá nhân', to: '/account/profile' }, 'Đổi mật khẩu')} />
      <h1 className="page__title">Đổi mật khẩu</h1>

      <form className="card ac-narrow" onSubmit={submit} noValidate>
        <div className="card__body stack ac-form">
          <div className="alert alert--info">
            <Info size={18} />
            <div>Sau khi đổi, hãy dùng mật khẩu mới cho những lần đăng nhập sau. Mật khẩu cũ sẽ không còn dùng được.</div>
          </div>
          {serverError && (
            <div className="alert alert--danger" role="alert">
              <AlertCircle size={18} />
              <div>{serverError}</div>
            </div>
          )}
          <FormField label="Mật khẩu hiện tại" required error={errors.currentPassword}>
            <PasswordInput autoComplete="current-password" autoFocus value={values.currentPassword} onChange={onCurrentChange} />
          </FormField>
          <NewPasswordFields values={values} errors={errors} onChange={change} onBlur={blur} />
        </div>
        <div className="card__body page-actions ac-actions">
          <Link to={backTo} className="btn">
            <ArrowLeft size={16} /> Hủy
          </Link>
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? <Spinner small /> : <KeyRound size={16} />} {busy ? 'Đang lưu...' : 'Đổi mật khẩu'}
          </button>
        </div>
      </form>
    </div>
  );
}
