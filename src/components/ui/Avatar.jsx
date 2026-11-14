import { useState } from 'react';
import { useAccountPhotoUrl } from '@/hooks/useAccountPhotoUrl';
import { initials } from '@/utils/format';

/** Ảnh đại diện tài khoản (BE AUTH-27) nếu có và được xem; không có ảnh, chưa tải hoặc ảnh lỗi thì hiện chữ cái đầu. */
export function Avatar({ user, size = 'md' }) {
  const url = useAccountPhotoUrl(user);
  const [broken, setBroken] = useState(null);
  if (!user) return <span className={`avatar avatar--${size} avatar--placeholder`}>?</span>;
  if (url && broken !== url) {
    return <img src={url} alt="" aria-hidden="true" className={`avatar avatar--${size} avatar--photo`} onError={() => setBroken(url)} />;
  }
  return (
    <span className={`avatar avatar--${size}`} style={{ background: user.avatarColor || 'var(--neutral-avatar)' }} aria-hidden="true">
      {initials(user.fullName)}
    </span>
  );
}
