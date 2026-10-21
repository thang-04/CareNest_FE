import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, Info, FlaskConical, CheckCircle2, ChevronDown } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { AuthLayout } from '@/layouts/AuthLayout';
import { Avatar, FormField, PasswordInput, Spinner } from '@/components';
import { IS_DEMO_MODE, DEMO_LOGIN_PASSWORD, getDemoAccounts } from '@/services/authService';
import { ROLE_LABELS } from '@/models/User';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = ({ email, password }) => {
  const e = {};
  if (!email.trim()) e.email = 'Vui lòng nhập email';
  else if (!EMAIL_RE.test(email.trim())) e.email = 'Email chưa đúng định dạng (ví dụ: ten@carenest.edu.vn)';
  if (!password) e.password = 'Vui lòng nhập mật khẩu';
  return e;
};

/** Mock mode only: gập thành một dòng; mở ra chọn một vai trò là điền sẵn tài khoản để thử. */
function DemoAccounts({ onPick }) {
  const [accounts, setAccounts] = useState([]);
  useEffect(() => {
    // Mỗi vai trò chỉ giữ tài khoản đầu tiên — đủ để thử từng role, danh sách gọn
    getDemoAccounts().then((list) => setAccounts(list.filter((u, i, all) => all.findIndex((x) => x.role === u.role) === i)));
  }, []);
  if (!accounts.length) return null;
  return (
    <details className="demo-switch">
      <summary>
        <FlaskConical size={16} className="text-primary" aria-hidden="true" />
        <b>Tài khoản demo</b>
        <span className="demo-switch__hint muted text-xs">
          {accounts.length} vai trò · mật khẩu {DEMO_LOGIN_PASSWORD}
        </span>
        <ChevronDown size={16} className="demo-switch__caret" aria-hidden="true" />
      </summary>
      <div className="demo-switch__list">
        {accounts.map((u) => (
          <button key={u.id} type="button" className="demo-chip" title={`${u.fullName} · ${u.email}`} onClick={() => onPick(u.email)}>
            <Avatar user={u} size="sm" />
            {ROLE_LABELS[u.role]}
          </button>
        ))}
      </div>
    </details>
  );
}

export default function LoginPage() {
  const { login, sessionMessage } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: location.state?.email || '', password: '', remember: true });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  // Shown after a password reset / first-login change (account module).
  const notice = location.state?.notice || '';

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
    setServerError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const user = await login({ email: form.email.trim(), password: form.password, remember: form.remember }); // carenest:allow-secret – tên field, không phải giá trị bí mật
      toast.success(`Xin chào ${user.fullName}`, 'Đăng nhập thành công');
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      // Issued password (SRS 1.1 step 7): no session yet, the user must set a new password first.
      if (err.details?.passwordChangeRequired && err.details?.changeToken) {
        navigate('/reset-password', { state: { token: err.details.changeToken, mode: 'first-login', email: form.email.trim() } });
        return;
      }
      setServerError(err.message || 'Không đăng nhập được, vui lòng thử lại');
      setForm((f) => ({ ...f, password: '' }));
    } finally {
      setBusy(false);
    }
  };

  const onPasswordChange = (e) => set({ password: e.target.value }); // carenest:allow-secret – tên field, không phải giá trị bí mật

  const pickDemo = (email) => {
    set({ email, password: DEMO_LOGIN_PASSWORD }); // carenest:allow-secret – tên field, không phải giá trị bí mật
  };

  return (
    <AuthLayout
      title="Đăng nhập"
      subtitle="Dùng tài khoản do nhà trường cấp"
      footer={IS_DEMO_MODE ? <DemoAccounts onPick={pickDemo} /> : null}
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        {notice && !serverError && (
          <div className="alert alert--success" role="status">
            <CheckCircle2 size={18} />
            <div>{notice}</div>
          </div>
        )}
        {sessionMessage && !serverError && !notice && (
          <div className="alert alert--warning">
            <Info size={18} />
            <div>{sessionMessage}</div>
          </div>
        )}
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
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </FormField>

        <FormField label="Mật khẩu" required error={errors.password}>
          <PasswordInput autoComplete="current-password" placeholder="Nhập mật khẩu" value={form.password} onChange={onPasswordChange} />
        </FormField>

        <div className="auth-form__row">
          <label className="checkbox">
            <input type="checkbox" checked={form.remember} onChange={(e) => set({ remember: e.target.checked })} />
            Ghi nhớ đăng nhập
          </label>
          <Link to="/forgot-password" state={{ email: form.email.trim() }} className="link-btn">
            Quên mật khẩu?
          </Link>
        </div>

        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? <Spinner small /> : <LogIn size={18} />} {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </AuthLayout>
  );
}
