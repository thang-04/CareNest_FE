import { readDb, writeDb, clone, delay, needsMockSeedMigration } from './mockDatabase';
import { DEMO_NOTIFICATION_VERSION, buildDemoNotifications } from './notificationSeed';
import { uid } from '@/utils/id';
import { FACILITY_ENABLED } from '@/config/app';

/** Server-side helper: called inside writeDb by other repositories. */
export const pushNotification = (db, { userId, type, title, message, link }) => {
  if (!userId) return;
  db.notifications.unshift({ id: uid('n'), userId, type, title, message, link, read: false, createdAt: new Date().toISOString() });
};

// Nạp thông báo demo một lần (DB mới hoặc DB lưu từ trước), không ghi đè thông báo đã có
const ensureDemoNotifications = () => {
  if (!needsMockSeedMigration(readDb(), 'notifications', DEMO_NOTIFICATION_VERSION, ['notifications'])) return;
  writeDb((db) => {
    const has = new Set((db.notifications || []).map((n) => n.id));
    db.notifications = [...(db.notifications || []), ...buildDemoNotifications().filter((n) => !has.has(n.id))].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    db.mockSeedVersions = { ...(db.mockSeedVersions || {}), notifications: DEMO_NOTIFICATION_VERSION };
  });
};

export const notificationMockRepository = {
  async list(userId) {
    await delay(80);
    ensureDemoNotifications();
    return clone(readDb().notifications.filter((n) => n.userId === userId && (FACILITY_ENABLED || !n.link?.startsWith('/facility'))));
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
