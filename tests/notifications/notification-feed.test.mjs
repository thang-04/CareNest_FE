import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notificationTarget } from '../../src/utils/notifications/notificationTarget.mjs';
import { createNotificationApi } from '../../src/services/notificationApi.mjs';

test('thông báo trường và tin không có link mở detail; link giáo dục cũ giữ nguyên', () => {
  assert.equal(notificationTarget({ id: 51, announcementId: 8, link: '/education/day-plans/5' }), '/notifications/51');
  assert.equal(notificationTarget({ id: 52, link: null }), '/notifications/52');
  assert.equal(notificationTarget({ id: 53, link: '/education/day-plans/5' }), '/education/day-plans/5');
});

test('dùng unreadCount server lớn hơn 50 và lấy trực tiếp tin ngoài danh sách', async () => {
  const calls = [];
  const client = {
    get: async (path) => {
      calls.push(path);
      return path.endsWith('/999')
        ? { id: 999, body: 'Nội dung', announcementId: 42, childId: 7 }
        : { items: Array.from({ length: 50 }, (_, id) => ({ id, body: 'mẫu' })), unreadCount: 73 };
    },
  };
  const api = createNotificationApi(client);
  const feed = await api.feed();
  const detail = await api.detail(999);
  assert.equal(feed.items.length, 50);
  assert.equal(feed.unreadCount, 73);
  assert.equal(detail.announcementId, 42);
  assert.equal(detail.childId, 7);
  assert.deepEqual(calls, ['/me/notifications', '/me/notifications/999']);
});
