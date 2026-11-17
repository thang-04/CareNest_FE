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

test('soạn lịch riêng hoặc điền mẫu lưu độc lập; bật/tắt chỉ lịch được tick, kiểm đủ ids trước đổi', async () => {
  const actor = readDb().users.find((user) => user.role === 'PRINCIPAL');
  const vice = readDb().users.find((user) => user.role === 'VICE_PRINCIPAL');
  const base = { target: { scopeType: 'SCHOOL', roles: ['PARENT'] }, frequency: 'WEEKLY', dayOfWeek: 1, sendTime: '08:00', active: true };
  const own = await repo.createSchedule({ ...base, title: 'Tin tự soạn', body: 'Nội dung riêng' }, [new File(['PDF'], 'demo.pdf')], actor);
  assert.equal(own.templateId, undefined);
  assert.equal(own.attachments.length, 1);
  const template = await repo.createTemplate({ name: 'Mẫu lịch', title: 'Cũ', body: 'Nội dung cũ', campusId: null }, actor);
  const fromTemplate = await repo.createSchedule({ ...base, templateId: template.id }, [], actor);
  await repo.updateTemplate(template.id, { ...template, title: 'Mới', body: 'Nội dung mới' }, actor);
  assert.equal((await repo.schedule(fromTemplate.id, actor)).title, 'Cũ');
  assert.equal(await repo.activateSchedules([own.id], false, actor), 1);
  assert.equal((await repo.schedule(own.id, actor)).active, false);
  assert.equal((await repo.schedule(fromTemplate.id, actor)).active, true);
  await assert.rejects(repo.activateSchedules([own.id, -1], true, actor));
  assert.equal((await repo.schedule(own.id, actor)).active, false);
  assert.equal(await repo.activateSchedules([own.id, fromTemplate.id], false, actor), 1);
  await assert.rejects(repo.activateSchedules([own.id], true, vice), (error) => error.status === 403);
  const edited = await repo.updateSchedule(own.id, { ...base, title: 'Đã sửa', body: 'Riêng', keepAttachmentIds: [] }, [], actor);
  assert.equal(edited.attachments.length, 0);
  assert.equal(edited.title, 'Đã sửa');
  await assert.rejects(repo.deleteSchedules([own.id, 999999], actor));
  assert.ok(await repo.schedule(own.id, actor));
  await assert.rejects(repo.deleteSchedules([own.id], vice), (error) => error.status === 403);
  await repo.activateSchedules([own.id], true, actor);
  await assert.rejects(repo.deleteSchedules([own.id, fromTemplate.id], actor), (error) => error.status === 409);
  await repo.activateSchedules([own.id, fromTemplate.id], false, actor);
  assert.equal(await repo.deleteSchedules([own.id, fromTemplate.id], actor), 2);
  await assert.rejects(repo.schedule(own.id, actor));
});

test('checkbox chọn tất cả trừ tin bỏ tick ở trang sau; ids hỗn hợp không xóa một phần', async () => {
  const actor = readDb().users.find((user) => user.role === 'PRINCIPAL');
  const classroom = (await repo.schoolStructure()).classes.find((item) => item.teacherIds.length > 0);
  const target = { scopeType: 'CLASSROOM', classroomId: classroom.id, campusId: null, ageGroupId: null, roles: ['TEACHER'] };
  const rows = [];
  for (let i = 0; i < 25; i++) {
    const row = await repo.create({ title: `checkbox-demo-${i}`, body: 'Demo', target, sendAt: '2026-12-01T01:00:00Z' }, [], actor);
    rows.push(await repo.cancel(row.id, actor));
  }
  const filters = { q: 'checkbox-demo', status: 'CANCELLED' };
  assert.equal((await repo.list({ ...filters, size: 20 }, actor)).cancelledCount, 25);
  const keep = rows[0];
  assert.equal(await repo.deleteSelection({ ...filters, allMatching: true, ids: [], excludedIds: [keep.id] }, actor), 24);
  assert.equal((await repo.list(filters, actor)).cancelledCount, 1);
  const sent = await repo.create({ title: 'checkbox-demo-sent', body: 'Demo', target, sendAt: null }, [], actor);
  await assert.rejects(
    repo.deleteSelection({ allMatching: false, ids: [keep.id, sent.id], excludedIds: [] }, actor),
    (error) => error.status === 409,
  );
  assert.equal((await repo.detail(keep.id, actor)).status, 'CANCELLED');
  assert.equal(await repo.deleteSelection({ allMatching: false, ids: [keep.id], excludedIds: [] }, actor), 1);
});

test('xóa tin đã hủy theo filter trên mọi trang, giữ tin ngoài scope/trạng thái/từ khóa', async () => {
  const actor = readDb().users.find((user) => user.role === 'PRINCIPAL');
  const vice = readDb().users.find((user) => user.role === 'VICE_PRINCIPAL');
  const campuses = await repo.campuses();
  const ownCampus = campuses.find((item) => item.key === vice.campusId);
  const otherCampus = campuses.find((item) => item.key !== vice.campusId);
  const q = 'cleanup-filter-demo';
  const make = async (title, campusId, cancelled) => {
    const row = await repo.create(
      {
        title,
        body: 'Nội dung',
        sendAt: '2026-12-01T01:00:00Z',
        target: { scopeType: 'CAMPUS', campusId, ageGroupId: null, classroomId: null, roles: ['TEACHER'] },
      },
      [],
      actor,
    );
    return cancelled ? repo.cancel(row.id, actor) : row;
  };
  for (let i = 0; i < 25; i++) await make(`${q}-${i}`, ownCampus.id, true);
  const outside = await make(q, otherCampus.id, true);
  const scheduled = await make(q, ownCampus.id, false);
  const other = await make('other-cancelled-demo', ownCampus.id, true);
  assert.equal((await repo.list({ q, status: 'CANCELLED', page: 0, size: 20 }, vice)).totalElements, 25);
  assert.equal((await repo.list({ q, status: 'CANCELLED', page: 1, size: 20 }, vice)).items.length, 5);
  assert.equal(await repo.deleteCancelled({ q, status: 'CANCELLED' }, vice), 25);
  assert.equal((await repo.list({ q, status: 'CANCELLED' }, vice)).totalElements, 0);
  assert.equal((await repo.detail(outside.id, actor)).status, 'CANCELLED');
  assert.equal((await repo.detail(scheduled.id, vice)).status, 'SCHEDULED');
  assert.equal((await repo.detail(other.id, vice)).status, 'CANCELLED');
  const teacher = readDb().users.find((user) => user.role === 'TEACHER');
  await assert.rejects(repo.delete(other.id, teacher), (error) => error.status === 403);
  await assert.rejects(repo.deleteCancelled({ q }, teacher), (error) => error.status === 403);
  await assert.rejects(repo.delete(scheduled.id, vice), (error) => error.status === 409);
  await repo.delete(other.id, vice);
  await assert.rejects(repo.detail(other.id, vice), (error) => error.status === 404);
});

test('người gửi không tự nhận kể cả chọn BGH trong phạm vi mình quản lý', async () => {
  const actor = readDb().users.find((user) => user.role === 'PRINCIPAL');
  const before = readDb().notifications.filter((item) => item.userId === actor.id).length;
  await repo.create(
    {
      title: 'BGH sender exclusion',
      body: 'Demo',
      sendAt: null,
      target: { scopeType: 'SCHOOL', campusId: null, ageGroupId: null, classroomId: null, roles: ['BGH'] },
    },
    [],
    actor,
  );
  assert.equal(readDb().notifications.filter((item) => item.userId === actor.id).length, before);
});

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
