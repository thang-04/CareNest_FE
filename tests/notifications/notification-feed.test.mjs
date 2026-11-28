import assert from 'node:assert/strict';
import { test } from 'node:test';
import { notificationTarget } from '../../src/utils/notifications/notificationTarget.mjs';
import { createNotificationApi } from '../../src/services/notificationApi.mjs';
import { notificationTypeLabel } from '../../src/utils/notificationLabel.mjs';

test('mọi loại thông báo luôn mở nội dung thông báo trước kể cả có link hồ sơ', () => {
  assert.equal(notificationTarget({ id: 51, announcementId: 8, link: '/education/day-plans/5' }), '/notifications/51');
  assert.equal(notificationTarget({ id: 52, link: null }), '/notifications/52');
  assert.equal(notificationTarget({ id: 53, link: '/education/day-plans/5' }), '/notifications/53');
  for (const [type, link] of [
    ['EDU_SUBMITTED', '/education/plan-reviews'],
    ['CHILD_PICKED_UP', '/pickup'],
    ['DAILY_HEALTH_NOTED', '/children/7/health'],
    ['LEAVE_REQUEST_CREATED', '/attendance/leave-requests'],
    ['MENU_PUBLISHED', '/kitchen/published-menu'],
  ]) {
    const notification = { id: 54, type, link };
    assert.equal(notificationTarget(notification), '/notifications/54', type);
    assert.equal(notification.link, link, 'giữ đường dẫn để nút Xem chi tiết dùng ở bước sau');
  }
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

test('adapter giữ nhãn BE, type và trạng thái đọc cho cả feed và detail', async () => {
  const item = {
    id: 42,
    type: 'SCHOOL_ANNOUNCEMENT',
    typeLabel: 'Thông báo nhà trường',
    body: 'Nội dung',
    readAt: null,
    link: '/education/plan-reviews',
  };
  const api = createNotificationApi({ get: async (path) => (path.endsWith('/42') ? item : { items: [item], unreadCount: 1 }) });
  const feed = await api.feed();
  assert.equal(feed.items[0].typeLabel, 'Thông báo nhà trường');
  assert.equal(feed.items[0].type, item.type);
  assert.equal(feed.items[0].read, false);
  assert.equal((await api.detail(42)).typeLabel, 'Thông báo nhà trường');
  assert.equal((await api.detail(42)).link, item.link);
  assert.equal(notificationTypeLabel('NEW_SERVER_TYPE', 'Nhãn mới từ máy chủ'), 'Nhãn mới từ máy chủ');
});

test('mock hoặc BE cũ thiếu nhãn vẫn phân loại được, mã lạ không hiển thị trực tiếp', () => {
  assert.equal(notificationTypeLabel('EDU_RELEASED'), 'Kế hoạch giáo dục');
  assert.equal(notificationTypeLabel('DAILY_HEALTH_NOTED'), 'Sức khỏe trong ngày');
  assert.equal(notificationTypeLabel('CHILD_TB_CONTACT'), 'Sức khỏe');
  assert.equal(notificationTypeLabel('CHILD_PICKED_UP'), 'Đón trẻ');
  assert.equal(notificationTypeLabel('LEAVE_REQUEST_CREATED'), 'Đơn nghỉ');
  assert.equal(notificationTypeLabel('MENU_PUBLISHED'), 'Thực đơn');
  assert.equal(notificationTypeLabel('UNRECOGNIZED', '  '), 'Thông báo hệ thống');
  assert.equal(notificationTypeLabel(null), 'Thông báo hệ thống');
});
