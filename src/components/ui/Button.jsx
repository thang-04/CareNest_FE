import { Lock } from './icons';
import { Spinner } from './States';
import { Tooltip } from './Tooltip';

const BARE = { icon: 'icon-btn', link: 'link-btn' };

/**
 * Nút chuẩn của mọi màn — dùng thay cho <button className="btn …"> viết tay.
 * - `type` mặc định "button" (nút trong form không vô tình submit); nút gửi form ghi rõ type="submit".
 * - `loading`: hiện spinner thay icon và khóa bấm ⇒ không gửi hai lần.
 *
 * <Button variant="primary" icon={Plus} onClick={add}>Thêm nhà cung cấp</Button>
 * <Button variant="primary" type="submit" loading={saving} icon={Save}>{LABELS.save}</Button>
 * - `disabledReason`: nút vẫn hiện, khóa kèm ổ khóa và bóng chữ lý do (thiếu quyền, chưa đến hạn, quá hạn, đã khóa).
 *   Dùng aria-disabled thay cho disabled để vẫn rê chuột/Tab tới được và đọc được lý do.
 * <Button variant="primary" disabledReason="Bạn chỉ có quyền xem phiếu của Cơ sở 2.">Lập phiếu nhập</Button>
 */
export function Button({
  variant,
  size,
  icon: Icon,
  loading = false,
  disabled = false,
  disabledReason,
  type = 'button',
  className = '',
  onClick,
  children,
  ...rest
}) {
  const locked = !!disabledReason;
  // variant "icon" / "link" dùng class chung có sẵn .icon-btn / .link-btn (nút chỉ icon, nút dạng chữ), không kèm .btn
  const base = BARE[variant];
  const classes = (
    base
      ? [base, locked && 'is-locked', className]
      : ['btn', variant && `btn--${variant}`, size && `btn--${size}`, locked && 'btn--locked', className]
  )
    .filter(Boolean)
    .join(' ');
  const iconSize = size === 'sm' ? 15 : 16;
  const button = (
    <button
      type={type}
      className={classes}
      disabled={!locked && (disabled || loading)}
      aria-disabled={locked || undefined}
      aria-busy={loading || undefined}
      // Nút khóa: chặn cả click lẫn Enter/Space (trình duyệt quy về click), kể cả nút submit
      onClick={locked ? (e) => e.preventDefault() : onClick}
      {...rest}
    >
      {locked ? <Lock size={iconSize} /> : loading ? <Spinner small /> : Icon && <Icon size={iconSize} />}
      {children}
    </button>
  );
  return locked ? <Tooltip content={disabledReason}>{button}</Tooltip> : button;
}
