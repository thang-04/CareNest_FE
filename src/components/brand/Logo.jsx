import logoMark from '@/assets/brand/logo-mark.png';
import logoFull from '@/assets/brand/logo-full.png';

export const BRAND_NAME = 'CareNest';

/** Icon only (mother holding child). */
export function LogoMark({ size = 40 }) {
  return <img src={logoMark} width={size} height={size} alt={BRAND_NAME} className="logo-mark" />;
}

/** "Care" dark blue + "Nest" sky blue, same as the logo. */
export function Wordmark({ size = 24 }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      <span className="wordmark__care">Care</span>
      <span className="wordmark__nest">Nest</span>
    </span>
  );
}

/** Horizontal logo used in the sidebar. `collapsed` shows the icon only. */
export function Logo({ collapsed = false, size = 46 }) {
  return (
    <div className="logo">
      <LogoMark size={size} />
      {!collapsed && <Wordmark />}
    </div>
  );
}

/** Original stacked logo (icon above the name) – for login, print, splash. */
export function LogoFull({ width = 160 }) {
  return <img src={logoFull} width={width} alt={BRAND_NAME} className="logo-full" />;
}
