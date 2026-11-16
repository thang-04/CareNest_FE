import assert from 'node:assert/strict';
import { test } from 'node:test';

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
globalThis.window = new EventTarget();
const { announcementMockRepository: repo } = await import('@/services/announcement/mock/announcementMockRepository');
const { accountMockRepository } = await import('@/services/account/mock/accountMockRepository');
const { readDb } = await import('@/mocks/mockDatabase');

test('mock preview dùng lớp/vai trò, bỏ người gửi và mở toàn văn qua notification', async () => {
  const actor = readDb().users.find((user) => user.role === 'PRINCIPAL');
  const classroom = (await repo.schoolStructure()).classes.find((item) => item.teacherIds.length > 0);
  const target = { scopeType: 'CLASSROOM', classroomId: classroom.id, campusId: null, ageGroupId: null, roles: ['TEACHER'] };
  const preview = await repo.preview(target, {}, actor);
  assert.equal(preview.total, new Set(classroom.teacherIds).size);
  const message = await repo.create({ title: 'Tin mẫu', body: 'D'.repeat(700), target, sendAt: null }, [], actor);
  assert.equal(message.recipientCount, preview.total);
  const receiver = readDb().users.find((user) => user.id === classroom.teacherIds[0]);
  const notification = readDb().notifications.find((item) => item.userId === receiver.id && item.announcementId === message.id);
  assert.equal(notification.message.length, 500);
  const full = await accountMockRepository.getNotification(notification.id, receiver);
  assert.equal(full.message.length, 700);
  assert.equal(full.senderName, actor.fullName);
});

test('PHT không được mock preview ngoài điểm trường của mình', async () => {
  const actor = readDb().users.find((user) => user.role === 'VICE_PRINCIPAL');
  const other = (await repo.campuses()).find((campus) => campus.key !== actor.campusId);
  await assert.rejects(
    repo.preview({ scopeType: 'CAMPUS', campusId: other.id, roles: ['TEACHER'] }, {}, actor),
    (error) => error.status === 403,
  );
});

test('mock quy tắc giữ câu chữ khi tắt và chặn biến không hợp lệ', async () => {
  const rules = await repo.rules();
  assert.equal(rules.filter((rule) => rule.editable).length, 8);
  const rule = rules.find((item) => item.type === 'MENU_PUBLISHED');
  const updated = await repo.updateRule(rule.type, { enabled: false, titleTemplate: 'Tuần {tuan}', bodyTemplate: 'Đã công bố {tuan}' });
  assert.equal(updated.titleTemplate, 'Tuần {tuan}');
  assert.equal(updated.enabled, false);
  await assert.rejects(
    repo.updateRule(rule.type, { enabled: true, titleTemplate: '{sai}', bodyTemplate: '' }),
    (error) => error.errorCode === 1212,
  );
  await assert.rejects(repo.updateRule('CHILD_PICKED_UP', { enabled: false }), (error) => error.errorCode === 1210);
});

test('PHT chỉ sửa mẫu của điểm trường mình và vẫn xem được mẫu toàn trường', async () => {
  const principal = readDb().users.find((user) => user.role === 'PRINCIPAL');
  const vice = readDb().users.find((user) => user.role === 'VICE_PRINCIPAL');
  const other = (await repo.campuses()).find((campus) => campus.key !== vice.campusId);
  const global = await repo.createTemplate({ name: 'Mẫu chung', title: 'Tiêu đề', body: 'Nội dung', campusId: null }, principal);
  const visible = (await repo.templates(vice)).find((item) => item.id === global.id);
  assert.equal(visible.canEdit, false);
  await assert.rejects(repo.updateTemplate(global.id, { ...global }, vice), (error) => error.status === 403);
  await assert.rejects(
    repo.createTemplate({ name: 'Sai điểm', title: 'Tin', body: 'Nội dung', campusId: other.id }, vice),
    (error) => error.status === 403,
  );
});
