import { USE_MOCK } from '@/config/env';
import { axiosClient } from '@/services/http/axiosClient';
import { notificationMockRepository } from '@/mocks/notificationMockRepository';

const api = {
  list: () => axiosClient.get('/notifications/me'),
  markRead: (id) => axiosClient.patch(`/notifications/${id}/read`),
  markAllRead: () => axiosClient.patch('/notifications/me/read-all'),
};

export const getNotifications = (userId) => (USE_MOCK ? notificationMockRepository.list(userId) : api.list());
export const markNotificationRead = (id) => (USE_MOCK ? notificationMockRepository.markRead(id) : api.markRead(id));
export const markAllNotificationsRead = (userId) => (USE_MOCK ? notificationMockRepository.markAllRead(userId) : api.markAllRead());
