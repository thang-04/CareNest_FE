import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, KeyRound, RotateCw, ShieldAlert } from '@/components/ui/icons';
import { AuthLayout } from '@/layouts/AuthLayout';
import { useToast } from '@/contexts/ToastContext';
import { Spinner } from '@/components';
import { NewPasswordFields } from '@/components/account/NewPasswordFields';
import { setPasswordWithToken } from '@/services/account/accountService';
import { validatePasswordChange } from '@/utils/account/accountValidation';
import '@/styles/modules/account.css';

const COPY = {
  reset: {
    title: 'Đặt lại mật khẩu',
    subtitle: 'Mã xác thực hợp lệ. Hãy đặt mật khẩu mới cho tài khoản của bạn.',
    restartTo: '/forgot-password',
    restartLabel: 'Bắt đầu lại',
  },
  'first-login': {
    title: 'Đổi mật khẩu lần đầu',
    subtitle: 'Tài khoản đang dùng mật khẩu được cấp. Bạn cần đặt mật khẩu mới trước khi vào hệ thống.',
    restartTo: '/login',
    restartLabel: 'Đăng nhập lại',
  },
};

/**
 * Screen 4 – Password Reset (SRS 1.6 steps 6–9). Also serves the forced change at the first sign-in with an
 * issued password (SRS 1.1 step 7, screen 6 entry from Log In): both set a password with a one-time token, then return to Log In.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const token = location.state?.token || '';
  const mode = location.state?.mode === 'first-login' ? 'first-login' : 'reset';
  const email = location.state?.email || '';
  const copy = COPY[mode];
  const [values, setValues] = useState({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [gone, setGone] = useState(token ? '' : 'Phiên đặt mật khẩu không còn hiệu lực. Vui lòng thực hiện lại từ đầu.');
  const [busy, setBusy] = useState(false);

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
    const e = validatePasswordChange(values);
    if (values[field]) setErrors((prev) => ({ ...prev, [field]: e[field] }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const e = validatePasswordChange(values);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const result = await setPasswordWithToken({ token, ...values });
      toast.success('Mật khẩu của bạn đã được thay đổi thành công.');
      navigate('/login', {
        replace: true,
        state: { email: result?.email || email, notice: 'Mật khẩu mới đã được lưu. Vui lòng đăng nhập bằng mật khẩu mới.' },
      });
    } catch (err) {
      if (err.status === 410) setGone(err.message);
      else if (err.details && typeof err.details === 'object') setErrors(err.details);
      else setServerError(err.message || 'Chưa lưu được mật khẩu mới. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  if (gone) {
    return (
      <AuthLayout title={copy.title} subtitle="Không thể đặt mật khẩu với yêu cầu này.">
        <div className="auth-form">
          <div className="alert alert--warning" role="alert">
            <ShieldAlert size={18} />
            <div>{gone}</div>
          </div>
          <Link to={copy.restartTo} state={{ email }} className="btn btn--primary btn--lg btn--block">
            <RotateCw size={18} /> {copy.restartLabel}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={copy.title} subtitle={copy.subtitle}>
      <form className="auth-form" onSubmit={submit} noValidate>
        {email && (
          <p className="ac-account-line">
            Tài khoản: <b>{email}</b>
          </p>
        )}
        {serverError && (
          <div className="alert alert--danger" role="alert">
            <AlertCircle size={18} />
            <div>{serverError}</div>
          </div>
        )}
        <NewPasswordFields values={values} errors={errors} onChange={change} onBlur={blur} />
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? <Spinner small /> : <KeyRound size={18} />} {busy ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
        </button>
        <Link to="/login" className="ac-back-link">
          <ArrowLeft size={16} /> {mode === 'first-login' ? 'Hủy và quay lại đăng nhập' : 'Quay lại đăng nhập'}
        </Link>
      </form>
    </AuthLayout>
  );
}
