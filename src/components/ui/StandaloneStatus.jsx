import { useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogoMark, Wordmark } from '@/components/brand/Logo';
import { useAppearance } from '@/contexts/AppearanceContext';
import { sceneUrl } from '@/models/appearance/scenes';
import { usePageTitle } from '@/hooks/usePageTitle';
import { APP_NAME, SCHOOL_NAME } from '@/config/app';
import { StatusPage } from './StatusPage';
import '@/layouts/auth.css';

/**
 * Màn chặn toàn màn hình ngoài vỏ app (403/404 theo URL, phiên lỗi, tài khoản chưa có màn Web):
 * link người khác gửi không hiện sidebar của vai trò không có màn đó.
 * Portal ra body + `inert` cho #root để bàn phím/trình đọc màn hình không lọt vào vỏ app phía sau.
 */
export function StandaloneStatus({ kind = '404', title, description, action, note, pageTitle, children }) {
  const { sceneId } = useAppearance();
  usePageTitle(pageTitle || title);

  useLayoutEffect(() => {
    const root = document.getElementById('root');
    if (!root) return undefined;
    root.inert = true;
    return () => {
      root.inert = false;
    };
  }, []);

  return createPortal(
    <div className="auth standalone">
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
      <main className="standalone__main">
        <div className="auth__card standalone__card">
          {children || <StatusPage kind={kind} title={title} description={description} action={action} bare />}
          {note && <p className="standalone__note">{note}</p>}
        </div>
      </main>
      <footer className="auth__copyright auth__frost">
        © {new Date().getFullYear()} {APP_NAME} · {SCHOOL_NAME}
      </footer>
    </div>,
    document.body,
  );
}
