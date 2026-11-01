/** Công tắc bật/tắt (role="switch"). Dùng cho tùy chọn có hiệu lực ngay trong form, không thay cho checkbox nhiều lựa chọn. */
export function Switch({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
    />
  );
}
