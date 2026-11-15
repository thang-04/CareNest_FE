import { PortraitImage } from '@/components/PortraitImage';
import { avatarTone, initials } from '@/utils/format';

/**
 * Ảnh đại diện của trẻ (photoUrl từ hồ sơ trẻ); không có ảnh hoặc ảnh lỗi thì hiện chữ cái đầu.
 * size: '' (36px), 'lg' (40px), 'sm' (28px) — dùng chung lớp .avatar.
 */
export function ChildAvatar({ child, size = '' }) {
  const sizeClass = size ? ` avatar--${size}` : '';
  return (
    <PortraitImage source={child?.photoUrl} alt={`Ảnh của ${child?.fullName || 'trẻ'}`} className={`avatar${sizeClass} avatar--photo`}>
      <span className={`avatar${sizeClass} avatar--tone-${avatarTone(child?.fullName)}`} aria-hidden="true">
        {initials(child?.fullName || '?')}
      </span>
    </PortraitImage>
  );
}
