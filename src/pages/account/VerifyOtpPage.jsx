import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, FlaskConical, MailCheck, RotateCw, ShieldCheck } from 'lucide-react';
import { AuthLayout } from '@/layouts/AuthLayout';
import { useToast } from '@/contexts/ToastContext';
import { FormField, Spinner } from '@/components';
import { IS_OTP_DEMO, getDemoOtp, resendOtp, verifyOtp } from '@/services/account/accountService';
import { validateOtp } from '@/utils/account/accountValidation';
import { OTP_LENGTH } from '@/models/account/accountConstants';
import { formatCountdown, useSecondsLeft } from '@/hooks/account/useAccount';
import '@/styles/modules/account.css';

/** Mock mode only: shows the code that the real backend would email. */
function DemoOtpHint({ requestId, version }) {
  const [code, setCode] = useState(null);
  useEffect(() => {
    let alive = true;
    getDemoOtp(requestId).then((c) => alive && setCode(c));
    return () => {
      alive = false;
    };
  }, [requestId, version]);
  if (!code) return null;
  return (
    <div className="demo-accounts">
      <div className="row" style={{ gap: 6 }}>
        <FlaskConical size={16} className="text-primary" />
        <b>Mã OTP demo</b>
        <code className="ac-demo-otp">{code}</code>
      </div>
      <div className="muted text-sm mt-8">Chỉ hiện khi VITE_USE_MOCK=true. Bản thật gửi mã qua email.</div>
    </div>
  );
}

/** Screen 3 – OTP Verification (SRS 1.7). */
export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [request, setRequest] = useState(location.state?.request || null);
  const email = location.state?.email || '';
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({});
  const [gone, setGone] = useState(request ? '' : 'Không tìm thấy yêu cầu khôi phục mật khẩu. Vui lòng bắt đầu lại.');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [version, setVersion] = useState(0);
  const expiresIn = useSecondsLeft(request?.expiresAt);
  const resendIn = useSecondsLeft(request?.resendAvailableAt);
  const expired = !!request && expiresIn === 0;

  const handleError = (err) => {
    if (err.status === 410) setGone(err.message);
    else setErrors({ otp: err.details?.otp || err.message || 'Chưa xác thực được mã. Vui lòng thử lại.' });
  };

  const submit = async (event) => {
    event.preventDefault();
    const e = validateOtp({ otp });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const { resetToken } = await verifyOtp({ requestId: request.requestId, otp: otp.trim() });
      navigate('/reset-password', { replace: true, state: { token: resetToken, mode: 'reset', email } });
    } catch (err) {
      handleError(err);
      setOtp('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setErrors({});
    try {
      const next = await resendOtp(request.requestId);
      setRequest(next);
      setVersion((v) => v + 1);
      setOtp('');
      toast.success(`Đã gửi mã mới tới ${next.maskedDestination}`);
    } catch (err) {
      if (err.status === 410) setGone(err.message);
      else toast.error(err.message, 'Chưa gửi lại được mã');
    } finally {
      setResending(false);
    }
  };

  if (gone) {
    return (
      <AuthLayout title="Xác thực OTP" subtitle="Yêu cầu khôi phục mật khẩu cần được tạo lại.">
        <div className="auth-form">
          <div className="alert alert--warning" role="alert">
            <AlertCircle size={18} />
            <div>{gone}</div>
          </div>
          <Link to="/forgot-password" state={{ email }} className="btn btn--primary btn--lg btn--block">
            <RotateCw size={18} /> Bắt đầu lại
          </Link>
          <Link to="/login" className="ac-back-link">
            <ArrowLeft size={16} /> Quay lại đăng nhập
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Xác thực OTP"
      subtitle="Nhập mã gồm 6 chữ số đã gửi tới email của bạn."
      footer={IS_OTP_DEMO ? <DemoOtpHint requestId={request.requestId} version={version} /> : null}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="alert alert--info">
          <MailCheck size={18} />
          <div>
            Mã đã được gửi tới <b>{request.maskedDestination}</b>.{' '}
            {expired ? (
              <span className="text-danger fw-600">Mã đã hết hạn, vui lòng gửi lại mã mới.</span>
            ) : (
              <span>
                Mã hết hạn sau <b aria-live="off">{formatCountdown(expiresIn)}</b>.
              </span>
            )}
          </div>
        </div>

        <FormField label="Mã xác thực (OTP)" required error={errors.otp}>
          <input
            className="input ac-otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={OTP_LENGTH}
            placeholder="______"
            value={otp}
            disabled={expired}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH));
              setErrors({});
            }}
          />
        </FormField>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy || expired}>
          {busy ? <Spinner small /> : <ShieldCheck size={18} />} {busy ? 'Đang xác thực...' : 'Xác thực mã'}
        </button>

        <div className="auth-form__row">
          <Link to="/login" className="ac-back-link">
            <ArrowLeft size={16} /> Hủy
          </Link>
          <button type="button" className="link-btn" onClick={resend} disabled={resending || resendIn > 0}>
            {resending ? 'Đang gửi lại...' : resendIn > 0 ? `Gửi lại mã sau ${resendIn}s` : 'Gửi lại mã'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
