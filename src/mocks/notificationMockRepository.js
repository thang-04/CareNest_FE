import { readDb, writeDb, clone, delay } from './mockDatabase';
import { uid } from '@/utils/id';

/** Server-side helper: called inside writeDb by other repositories. */
export const pushNotification = (db, { userId, type, title, message, link }) => {
  if (!userId) return;
  db.notifications.unshift({ id: uid('n'), userId, type, title, message, link, read: false, createdAt: new Date().toISOString() });
};

export const notificationMockRepository = {
  async list(userId) {
    await delay(80);
    return clone(readDb().notifications.filter((n) => n.userId === userId));
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
