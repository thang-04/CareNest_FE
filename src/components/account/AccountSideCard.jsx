import { AtSign, Building, Mail, Phone, School, Utensils } from '@/components/ui/icons';
import { AccountPhotoActions } from '@/components/account/AccountPhotoActions';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES, ROLE_LABELS } from '@/models/User';
import { accountDutyTags } from '@/utils/account/accountPermissions';

/**
 * Thẻ tài khoản cột trái (Hồ sơ cá nhân, Đổi mật khẩu): là ai, phụ trách đâu, liên hệ nhanh.
 * children: phần cuối thẻ (nút thao tác hoặc thông tin bảo mật).
 */
export function AccountSideCard({ profile, children }) {
  const { user } = useAuth(); // thẻ này chỉ dùng cho hồ sơ của chính mình
  const scope = profile.scope || {};
  const workplace = profile.role === ROLES.PRINCIPAL ? 'Toàn trường' : scope.campusName;
  return (
    <aside className="card ac-side">
      <div className="ac-side__top">
        <Avatar user={profile} size="2xl" />
        <AccountPhotoActions user={profile} />
        <div className="ac-side__name">{profile.fullName}</div>
        <div className="ac-side__tags">
          <span className="chip chip--teal">
            <School size={14} /> {ROLE_LABELS[profile.role] || profile.role}
          </span>
          {accountDutyTags(user).map((tag) => (
            <span key={tag.key} className="chip chip--blue">
              <Utensils size={14} /> {tag.label}
            </span>
          ))}
        </div>
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
