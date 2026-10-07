import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Password input with show / hide toggle. Accepts every <input> prop. */
export const PasswordInput = forwardRef(function PasswordInput({ className = '', ...props }, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="input-group">
      <input ref={ref} {...props} type={visible ? 'text' : 'password'} className={`input ${className}`} />
      <button
        type="button"
        className="icon-btn input-group__action"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
});
