import { Spinner } from './States';

const BARE = { icon: 'icon-btn', link: 'link-btn' };

/**
 * Nút chuẩn của mọi màn — dùng thay cho <button className="btn …"> viết tay.
 * - `type` mặc định "button" (nút trong form không vô tình submit); nút gửi form ghi rõ type="submit".
 * - `loading`: hiện spinner thay icon và khóa bấm ⇒ không gửi hai lần.
 *
 * <Button variant="primary" icon={Plus} onClick={add}>Thêm nhà cung cấp</Button>
 * <Button variant="primary" type="submit" loading={saving} icon={Save}>{LABELS.save}</Button>
 */
export function Button({
  variant,
  size,
  icon: Icon,
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...rest
}) {
  // variant "icon" / "link" dùng class chung có sẵn .icon-btn / .link-btn (nút chỉ icon, nút dạng chữ), không kèm .btn
  const base = BARE[variant];
  const classes = (base ? [base, className] : ['btn', variant && `btn--${variant}`, size && `btn--${size}`, className])
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner small /> : Icon && <Icon size={size === 'sm' ? 15 : 16} />}
      {children}
    </button>
  );
}
