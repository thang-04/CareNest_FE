import { Baby, CalendarCheck, ChalkboardTeacher, Sparkle } from '@/components/ui/icons';
import { LogoMark, Wordmark } from '@/components/brand/Logo';
import { useAppearance } from '@/contexts/AppearanceContext';
import { sceneUrl } from '@/models/appearance/scenes';
import { DEFAULT_PRINT_TEMPLATE } from '@/config/printTemplate';
import { usePageTitle } from '@/hooks/usePageTitle';
import { APP_NAME, SCHOOL_NAME } from '@/config/app';
import './auth.css';

const POINTS = [
  { icon: Baby, tone: 'blue', text: 'Hồ sơ trẻ, xếp lớp và theo dõi sức khỏe' },
  { icon: CalendarCheck, tone: 'mint', text: 'Điểm danh, suất ăn và thực đơn mỗi ngày' },
  { icon: ChalkboardTeacher, tone: 'amber', text: 'Kế hoạch giáo dục, đánh giá và duyệt theo vai trò' },
];

/**
 * Layout for pages outside the app shell (đăng nhập, quên mật khẩu, đổi mật khẩu lần đầu…):
 * tranh sáp màu của ngày toàn màn, giới thiệu bên trái (ẩn ở màn hẹp), card form bên phải.
 */
export function AuthLayout({ title, subtitle, children, footer }) {
  usePageTitle(title);
  const { sceneId } = useAppearance();
  return (
    <div className="auth">
      <img className="auth__scene" src={sceneUrl(sceneId)} alt="" aria-hidden="true" />

      <header className="auth__topbar">
        <div className="auth__brandmark auth__frost">
          <span className="auth__logo-chip">
            <LogoMark size={40} />
          </span>
          <span>
            <Wordmark size={26} />
            <span className="auth__school">{SCHOOL_NAME}</span>
          </span>
        </div>
      </header>

      <div className="auth__layout">
        <section className="auth__intro auth__frost">
          <div className="auth__heading">
            <span className="auth__pill">
              <Sparkle size={16} aria-hidden="true" />
              {DEFAULT_PRINT_TEMPLATE.slogan}
            </span>
            <h2 className="auth__headline">
              Hệ thống quản lý
              <br />
              <span className="auth__headline-accent">trường mầm non</span>
            </h2>
          </div>
          <ul className="auth__points">
            {POINTS.map(({ icon: Icon, tone, text }) => (
              <li key={text} className="auth__point">
                <span className={`auth__point-icon auth__point-icon--${tone}`} aria-hidden="true">
                  <Icon size={20} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        <main className="auth__main">
          <div className="auth__card">
            <div className="auth__card-head">
              <h1 className="auth__title">{title}</h1>
              {subtitle && <p className="auth__subtitle">{subtitle}</p>}
            </div>
            {children}
          </div>
          {footer && <div className="auth__footer">{footer}</div>}
        </main>
      </div>

      <footer className="auth__copyright auth__frost">
        © {new Date().getFullYear()} {APP_NAME} · {SCHOOL_NAME}
      </footer>
    </div>
  );
}
