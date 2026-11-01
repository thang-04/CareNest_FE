import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from '@/hooks/useAsync';
import { getNotification, getProfile } from '@/services/account/accountService';

/** Own profile of the signed-in user. Pass { live: false } while the form is being edited. */
export function useProfile({ live = true } = {}) {
  const { user } = useAuth();
  return useAsync(() => getProfile(user), [user?.id], { refreshOnDataChange: live, enabled: !!user });
}

/** One notification of the signed-in user; opening it marks it as read. */
export function useNotificationDetail(id) {
  const { user } = useAuth();
  return useAsync(() => getNotification(id, user), [id, user?.id], { enabled: !!user && !!id });
}

/** Seconds left until `isoTime` (0 when passed or empty); ticks every second. */
export function useSecondsLeft(isoTime) {
  const target = isoTime ? new Date(isoTime).getTime() : 0;
  const compute = () => Math.max(0, Math.ceil((target - Date.now()) / 1000));
  const [left, setLeft] = useState(compute);
  useEffect(() => {
    setLeft(compute());
    if (!target) return undefined;
    const timer = setInterval(() => setLeft(compute()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return left;
}

export const formatCountdown = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
