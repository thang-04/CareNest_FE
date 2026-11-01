import { sourceOf } from '@/services/demoSource';
import { axiosClient } from '@/services/http/axiosClient';
import { notificationMockRepository } from '@/mocks/notificationMockRepository';

const api = {
  list: () => axiosClient.get('/notifications/me'),
  markRead: (id) => axiosClient.patch(`/notifications/${id}/read`),
  markAllRead: () => axiosClient.patch('/notifications/me/read-all'),
};

const repo = sourceOf('notifications', notificationMockRepository, api);

export const getNotifications = (userId) => repo.list(userId);
export const markNotificationRead = (id) => repo.markRead(id);
export const markAllNotificationsRead = (userId) => repo.markAllRead(userId);
