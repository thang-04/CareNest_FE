import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, RotateCcw, LogOut, Palette, Mail, Phone, Building2, UserRound, KeyRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useMasterData } from '@/hooks/useMasterData';
import { IS_DEMO_MODE, resetDemoData } from '@/services/authService';
import { ROLE_LABELS } from '@/models/User';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

/** Account box in the header: profile info, own profile / password links, developer links, logout. */
export function UserMenu() {
  const { user, logout } = useAuth();
  const md = useMasterData();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const onLogout = async () => {
    await logout();
    setConfirmLogout(false);
    toast.info('Bạn đã đăng xuất');
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
    <div className="dropdown" ref={ref}>
      <button className="user-box" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open}>
        <Avatar user={user} size="lg" />
        <div className="user-box__text">
          <div className="user-box__name">{user.fullName}</div>
          <div className="user-box__role">{ROLE_LABELS[user.role]}</div>
        </div>
        <ChevronDown size={18} />
      </button>
      {open && (
        <div className="dropdown__panel user-panel" role="menu">
          <div className="user-profile">
            <Avatar user={user} size="lg" />
            <div>
              <div className="fw-600">{user.fullName}</div>
              <div className="muted text-sm">{ROLE_LABELS[user.role]}</div>
            </div>
          </div>
          <div className="user-profile__info">
            <span>
              <Mail size={14} /> {user.email}
            </span>
            <span>
              <Phone size={14} /> {user.phone}
            </span>
            <span>
              <Building2 size={14} /> {md.campusById(user.campusId)?.name || '—'}
            </span>
          </div>

          <button
            className="user-option"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/account/profile');
            }}
          >
            <UserRound size={16} /> Hồ sơ cá nhân
          </button>
          <button
            className="user-option"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate('/account/password');
            }}
          >
            <KeyRound size={16} /> Đổi mật khẩu
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
              <RotateCcw size={16} /> Khôi phục dữ liệu demo
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
            <LogOut size={16} /> Đăng xuất
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
