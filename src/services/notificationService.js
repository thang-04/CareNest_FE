import { sourceOf } from '@/services/demoSource';
import { axiosClient } from '@/services/http/axiosClient';
import { announcements } from '@/services/announcement/announcementService';
import { notificationMockRepository } from '@/mocks/notificationMockRepository';
import { createNotificationApi } from './notificationApi.mjs';

// BE: NotificationController (/me/notifications); đổi sang dạng của chuông (read, message, link)
const api = createNotificationApi(axiosClient);

const repo = sourceOf('notifications', notificationMockRepository, api);

export const getNotifications = (userId) => repo.list(userId);
export const getNotificationFeed = async (userId) => {
  if (repo.feed) return repo.feed(userId);
  const items = await repo.list(userId);
  return { items, unreadCount: items.filter((item) => !item.read).length };
};
export const getNotification = async (id, userId) => {
  if (repo.detail) return repo.detail(id, userId);
  const found = (await repo.list(userId)).find((item) => String(item.id) === String(id));
  if (!found) throw Object.assign(new Error('Không tìm thấy thông báo'), { status: 404 });
  return found;
};
export const getMyAnnouncement = (id) => announcements.myAnnouncement(id);
export const getAnnouncementAttachment = (id) => announcements.attachment(id);
export const markNotificationRead = (id) => repo.markRead(id);
export const markAllNotificationsRead = (userId) => repo.markAllRead(userId);
