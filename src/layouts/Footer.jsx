import { APP_NAME, APP_VERSION, SCHOOL_NAME, SUPPORT_EMAIL } from '@/config/app';

/** App footer, same on every page inside MainLayout. Values come from config/app.js. */
export function Footer() {
  return (
    <footer className="app-footer no-print">
      <span>
        © {new Date().getFullYear()} {APP_NAME} · {SCHOOL_NAME}
      </span>
      <span>
        Hỗ trợ: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> · Phiên bản {APP_VERSION}
      </span>
    </footer>
  );
}
