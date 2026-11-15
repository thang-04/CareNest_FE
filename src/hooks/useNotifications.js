import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAsync } from './useAsync';
import { usePolling } from './usePolling';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/services/notificationService';

export function useNotifications() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => getNotifications(user.id), [user?.id], {
    refreshOnDataChange: true,
    enabled: !!user,
  });

  // Spec 003 FR-012: chuông tự cập nhật ≤30 giây khi có gói/hồ sơ gửi tới
  usePolling(() => reload({ silent: true }), { enabled: !!user });

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
  return { notifications, unreadCount: notifications.filter((n) => !n.read).length, loading, error, reload, markRead, markAllRead };
}
