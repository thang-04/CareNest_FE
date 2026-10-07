import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Send } from 'lucide-react';
import { AuthLayout } from '@/layouts/AuthLayout';
import { FormField, Spinner } from '@/components';
import { requestPasswordReset } from '@/services/account/accountService';
import { validateEmailForm } from '@/utils/account/accountValidation';
import '@/styles/modules/account.css';

/** Screen 2 – Forgot Password (SRS 1.6 steps 1–4): the web sends the OTP to the registered email. */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(location.state?.message || '');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const e = validateEmailForm({ email });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setServerError('');
    try {
      const request = await requestPasswordReset({ email: email.trim() });
      // Request data goes through router state, never the URL (no email / ids in the address bar).
      navigate('/verify-otp', { state: { request, email: email.trim() } });
    } catch (err) {
      if (err.details?.email) setErrors({ email: err.details.email });
      else setServerError(err.message || 'Chưa gửi được mã xác thực. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Quên mật khẩu" subtitle="Nhập email đã đăng ký, chúng tôi sẽ gửi mã xác thực (OTP) để bạn đặt lại mật khẩu.">
      <form className="auth-form" onSubmit={submit} noValidate>
        {serverError && (
          <div className="alert alert--danger" role="alert">
            <AlertCircle size={18} />
            <div>{serverError}</div>
          </div>
        )}
        <FormField label="Email" required error={errors.email}>
          <input
            className="input"
            type="email"
            autoComplete="username"
            autoFocus
            placeholder="ten@carenest.edu.vn"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErrors({});
              setServerError('');
            }}
            onBlur={() => email && setErrors(validateEmailForm({ email }))}
          />
        </FormField>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? <Spinner small /> : <Send size={18} />} {busy ? 'Đang gửi mã...' : 'Gửi mã xác thực'}
        </button>
        <Link to="/login" className="ac-back-link">
          <ArrowLeft size={16} /> Quay lại đăng nhập
        </Link>
      </form>
    </AuthLayout>
  );
}
