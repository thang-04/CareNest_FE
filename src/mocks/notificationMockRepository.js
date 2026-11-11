import { readDb, writeDb, clone, delay, needsMockSeedMigration } from './mockDatabase';
import { DEMO_NOTIFICATION_VERSION, buildDemoNotifications } from './notificationSeed';
import { uid } from '@/utils/id';
/** Server-side helper: called inside writeDb by other repositories. */
export const pushNotification = (db, { userId, type, title, message, link }) => {
  if (!userId) return;
  db.notifications.unshift({
    id: uid('n'),
    userId,
    type,
    title,
    message,
    link,
    read: false,
    createdAt: new Date().toISOString(),
  });
};

// Nạp thông báo demo một lần (DB mới hoặc DB lưu từ trước), không ghi đè thông báo đã có
const ensureDemoNotifications = () => {
  if (!needsMockSeedMigration(readDb(), 'notifications', DEMO_NOTIFICATION_VERSION, ['notifications'])) return;
  writeDb((db) => {
    // Phiếu theo dõi sức khỏe đã bỏ (HLT-16, 2026-11-04): xóa thông báo cũ trỏ tới màn không còn, kể cả bản demo cùng id.
    const kept = (db.notifications || []).filter((n) => n.type !== 'HEALTH_FOLLOW_UP');
    const has = new Set(kept.map((n) => n.id));
    db.notifications = [...kept, ...buildDemoNotifications().filter((n) => !has.has(n.id))].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    db.mockSeedVersions = {
      ...(db.mockSeedVersions || {}),
      notifications: DEMO_NOTIFICATION_VERSION,
    };
  });
};
export const notificationMockRepository = {
  async list(userId) {
    await delay(80);
    ensureDemoNotifications();
    return clone(readDb().notifications.filter((n) => n.userId === userId && !n.link?.startsWith('/facility')));
  },
  async markRead(id) {
    await delay(50);
    writeDb((db) => {
      const n = db.notifications.find((x) => x.id === id);
      if (n) n.read = true;
    });
  },
  async markAllRead(userId) {
    await delay(50);
    writeDb((db) => {
      db.notifications
        .filter((n) => n.userId === userId)
        .forEach((n) => {
          n.read = true;
        });
    });
  },
};
