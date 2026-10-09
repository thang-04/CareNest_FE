import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretUpDown, ArrowCounterClockwise, SignOut, Palette, UserCircle, Key, PaintBrush } from '@/components/ui/icons';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useClickOutside } from '@/hooks/useClickOutside';
import { IS_DEMO_MODE, resetDemoData } from '@/services/authService';
import { ROLE_LABELS } from '@/models/User';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

/** Account box ở đáy sidebar: profile info, own profile / password links, developer links, logout. Menu mở lên trên. */
export function UserMenu({ collapsed = false }) {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const onLogout = async () => {
    await logout();
    setConfirmLogout(false);
    toast.success('Bạn đã đăng xuất');
    navigate('/login', { replace: true });
  };

  const onReset = async () => {
    await resetDemoData();
    setConfirmReset(false);
    toast.success('Đã khôi phục dữ liệu demo ban đầu');
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="dropdown user-menu" ref={ref}>
      <button
        className="user-box"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={collapsed ? `Tài khoản: ${user.fullName}` : undefined}
        title={collapsed ? user.fullName : undefined}
      >
        <Avatar user={user} />
        <div className="user-box__text">
          <div className="user-box__name">{user.fullName}</div>
          <div className="user-box__role">{ROLE_LABELS[user.role]}</div>
        </div>
        <CaretUpDown size={16} className="user-box__caret" />
      </button>
      {open && (
        <div className="dropdown__panel user-panel" role="menu">
          {/* Tên, vai trò đã hiện ở hộp tài khoản; panel chỉ giữ email để biết đang đăng nhập tài khoản nào */}
          <div className="user-panel__email" title={user.email}>
            {user.email}
          </div>

          <button
            className="user-option"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/account/profile');
            }}
          >
            <UserCircle size={16} /> Hồ sơ cá nhân
          </button>
          <button
            className="user-option"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/account/password');
            }}
          >
            <Key size={16} /> Đổi mật khẩu
          </button>
          <button
            className="user-option"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/settings/appearance');
            }}
          >
            <PaintBrush size={16} /> Tùy chỉnh giao diện
          </button>
          {import.meta.env.DEV && (
            <button
              className="user-option"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                navigate('/ui-kit');
              }}
            >
              <Palette size={16} /> Thư viện giao diện (UI Kit)
            </button>
          )}
          {IS_DEMO_MODE && (
            <button
              className="user-option"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setConfirmReset(true);
              }}
            >
              <ArrowCounterClockwise size={16} /> Khôi phục dữ liệu demo
            </button>
          )}
          <button
            className="user-option user-option--danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setConfirmLogout(true);
            }}
          >
            <SignOut size={16} /> Đăng xuất
          </button>
        </div>
      )}
      <ConfirmationModal
        open={confirmLogout}
        title="Đăng xuất?"
        message="Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng hệ thống."
        confirmLabel="Đăng xuất"
        onConfirm={onLogout}
        onClose={() => setConfirmLogout(false)}
      />
      <ConfirmationModal
        open={confirmReset}
        title="Khôi phục dữ liệu demo?"
        message="Toàn bộ phiếu, chữ ký và thông báo tạo trong lúc test sẽ bị xóa và thay bằng dữ liệu mẫu. Bạn sẽ được đăng xuất."
        confirmLabel="Khôi phục dữ liệu"
        danger
        onConfirm={onReset}
        onClose={() => setConfirmReset(false)}
      />
    </div>
  );
}
