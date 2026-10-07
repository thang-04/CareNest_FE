import { initials } from '@/utils/format';

export function Avatar({ user, size = 'md' }) {
  if (!user)
    return (
      <span className={`avatar avatar--${size}`} style={{ background: 'var(--placeholder-avatar)' }}>
        ?
      </span>
    );
  return (
    <span className={`avatar avatar--${size}`} style={{ background: user.avatarColor || 'var(--neutral-avatar)' }} aria-hidden="true">
      {initials(user.fullName)}
    </span>
  );
}
