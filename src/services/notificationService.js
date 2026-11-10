import { sourceOf } from '@/services/demoSource';
import { axiosClient } from '@/services/http/axiosClient';
import { notificationMockRepository } from '@/mocks/notificationMockRepository';

// BE: NotificationController (/me/notifications); đổi sang dạng của chuông (read, message, link)
const toUi = (n) => ({ id: n.id, type: n.type, title: n.title, message: n.body, link: n.link || null, read: !!n.readAt, createdAt: n.createdAt });
const api = {
  list: async () => ((await axiosClient.get('/me/notifications'))?.items || []).map(toUi),
  markRead: (id) => axiosClient.post(`/me/notifications/${id}/read`),
  markAllRead: () => axiosClient.post('/me/notifications/read-all'),
};

const repo = sourceOf('notifications', notificationMockRepository, api);

export const getNotifications = (userId) => repo.list(userId);
export const markNotificationRead = (id) => repo.markRead(id);
export const markAllNotificationsRead = (userId) => repo.markAllRead(userId);
