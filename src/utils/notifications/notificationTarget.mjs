export function notificationTarget(notification) {
  if (notification.announcementId != null || !notification.link) return `/notifications/${notification.id}`;
  return notification.link;
}
