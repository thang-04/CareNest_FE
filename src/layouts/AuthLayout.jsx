import { LogoFull } from '@/components/brand/Logo';
import { DEFAULT_PRINT_TEMPLATE } from '@/config/printTemplate';
import { usePageTitle } from '@/hooks/usePageTitle';
import { APP_NAME, SCHOOL_NAME } from '@/config/app';
import './auth.css';

/**
 * Layout for pages outside the app shell (đăng nhập, quên mật khẩu, đổi mật khẩu lần đầu…):
 * brand panel on the left, a centered card on the right.
 */
export function AuthLayout({ title, subtitle, children, footer }) {
  usePageTitle(title);
  return (
    <div className="auth">
      <aside className="auth__brand" aria-hidden="true">
        <div className="auth__brand-inner">
          <div className="auth__logo-card">
            <LogoFull width={220} />
          </div>
          <h2 className="auth__headline">Hệ thống quản lý trường mầm non</h2>
          <p className="auth__tagline">{DEFAULT_PRINT_TEMPLATE.slogan}</p>
          <ul className="auth__points">
            <li>Quản lý cơ sở vật chất, luân chuyển và kiểm kê tài sản</li>
            <li>Ký số, in phiếu và theo dõi tiến độ theo từng vai trò</li>
            <li>Dữ liệu tập trung cho tất cả campus</li>
          </ul>
        </div>
      </aside>
      <main className="auth__main">
        <div className="auth__card card">
          <div className="auth__card-head">
            <h1 className="auth__title">{title}</h1>
            {subtitle && <p className="auth__subtitle">{subtitle}</p>}
          </div>
          {children}
        </div>
        {footer && <div className="auth__footer">{footer}</div>}
        <div className="auth__copyright">
          © {new Date().getFullYear()} {APP_NAME} · {SCHOOL_NAME}
        </div>
      </main>
    </div>
  );
}
