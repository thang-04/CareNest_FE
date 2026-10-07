import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from './useAsync';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/notificationService';

export function useNotifications() {
  const { user } = useAuth();
  const { data, loading, reload } = useAsync(() => getNotifications(user.id), [user?.id], {
    refreshOnDataChange: true,
    enabled: !!user,
  });

  const markRead = useCallback(
    async (id) => {
      await markNotificationRead(id);
      reload({ silent: true });
    },
    [reload],
  );

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead(user.id);
    reload({ silent: true });
  }, [reload, user?.id]);

  const notifications = data || [];
  return { notifications, unreadCount: notifications.filter((n) => !n.read).length, loading, markRead, markAllRead };
}
