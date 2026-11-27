import { notificationTypeLabel } from '../utils/notificationLabel.mjs';

const toUi = (n) => ({
  id: n.id,
  type: n.type,
  typeLabel: notificationTypeLabel(n.type, n.typeLabel),
  title: n.title,
  message: n.body,
  link: n.link || null,
  announcementId: n.announcementId ?? null,
  childId: n.childId ?? null,
  read: !!n.readAt,
  createdAt: n.createdAt,
});

export const createNotificationApi = (client) => ({
  list: async () => ((await client.get('/me/notifications'))?.items || []).map(toUi),
  feed: async () => {
    const result = await client.get('/me/notifications');
    return { items: (result?.items || []).map(toUi), unreadCount: result?.unreadCount ?? 0 };
  },
  detail: async (id) => toUi(await client.get(`/me/notifications/${id}`)),
  markRead: (id) => client.post(`/me/notifications/${id}/read`),
  markAllRead: () => client.post('/me/notifications/read-all'),
});
