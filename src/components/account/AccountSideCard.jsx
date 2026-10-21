import { AtSign, Building, Mail, Phone, School } from '@/components/ui/icons';
import { Avatar } from '@/components/ui/Avatar';
import { ROLES, ROLE_LABELS } from '@/models/User';

/**
 * Thẻ tài khoản cột trái (Hồ sơ cá nhân, Đổi mật khẩu): là ai, phụ trách đâu, liên hệ nhanh.
 * children: phần cuối thẻ (nút thao tác hoặc thông tin bảo mật).
 */
export function AccountSideCard({ profile, children }) {
  const scope = profile.scope || {};
  const workplace = profile.role === ROLES.PRINCIPAL ? 'Toàn trường' : scope.campusName;
  return (
    <aside className="card ac-side">
      <div className="ac-side__top">
        <Avatar user={profile} size="2xl" />
        <div className="ac-side__name">{profile.fullName}</div>
        <span className="chip chip--teal">
          <School size={14} /> {ROLE_LABELS[profile.role] || profile.role}
        </span>
      </div>
      <ul className="ac-side__facts">
        {(scope.className || workplace) && (
          <li>
            <Building size={16} />
            <span>{[scope.className, workplace].filter(Boolean).join(' · ')}</span>
          </li>
        )}
        <li>
          <Mail size={16} />
          <span>{profile.email}</span>
        </li>
        <li>
          <Phone size={16} />
          <span>{profile.phone || <span className="ac-empty">Chưa cập nhật</span>}</span>
        </li>
        {profile.username && (
          <li>
            <AtSign size={16} />
            <span>{profile.username}</span>
          </li>
        )}
      </ul>
      {children}
    </aside>
  );
}
