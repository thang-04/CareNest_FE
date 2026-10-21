import { useState } from 'react';
import { avatarTone, initials } from '@/utils/format';

/**
 * Ảnh đại diện của trẻ (photoUrl từ hồ sơ trẻ); không có ảnh hoặc ảnh lỗi thì hiện chữ cái đầu.
 * size: '' (36px), 'lg' (40px), 'sm' (28px) — dùng chung lớp .avatar.
 */
export function ChildAvatar({ child, size = '' }) {
  const [broken, setBroken] = useState(false);
  const sizeClass = size ? ` avatar--${size}` : '';
  if (child?.photoUrl && !broken)
    return <img className={`avatar${sizeClass} avatar--photo`} src={child.photoUrl} alt="" onError={() => setBroken(true)} />;
  return (
    <span className={`avatar${sizeClass} avatar--tone-${avatarTone(child?.fullName)}`} aria-hidden="true">
      {initials(child?.fullName || '?')}
    </span>
  );
}
