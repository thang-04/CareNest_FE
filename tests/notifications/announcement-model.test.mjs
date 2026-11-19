import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPreviewCoordinator } from '../../src/components/announcement/previewCoordinator.mjs';
import { prepareAnnouncementSubmission, validateAnnouncementFiles } from '../../src/components/announcement/prepareSubmission.mjs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

test('form chỉ có một thanh thao tác và nút gửi không bị khóa vì chưa xem trước thủ công', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: AnnouncementForm } = await server.ssrLoadModule('/src/components/announcement/AnnouncementForm.jsx');
    const { AuthProvider } = await server.ssrLoadModule('/src/contexts/AuthContext.jsx');
    const render = (busy) =>
      renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          null,
          React.createElement(AuthProvider, null, React.createElement(AnnouncementForm, { busy, onSave: () => {} })),
        ),
      );
    const html = render(false);
    assert.equal((html.match(/announcement-compose-toolbar/g) || []).length, 1);
    assert.equal((html.match(/href="\/announcements"/g) || []).length, 1);
    assert.equal((html.match(/type="submit"/g) || []).length, 1);
    assert.match(html, /class="page-toolbar__leading"><a[^>]+href="\/announcements"/);
    assert.match(html, /class="page-toolbar__actions"><button[^>]+type="submit"/);
    const submit = html.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0];
    assert.ok(submit);
    assert.doesNotMatch(submit, /\sdisabled=/);
    assert.match(render(true).match(/<button\b[^>]*type="submit"[^>]*>/)[0], /\sdisabled=/);
    const recurring = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        null,
        React.createElement(AuthProvider, null, React.createElement(AnnouncementForm, { recurring: true, onSave: () => {} })),
      ),
    );
    assert.match(recurring, /Tạo lịch gửi/);
    assert.match(recurring, /href="\/announcement-schedules"/);
    assert.match(recurring, /Tiêu đề/);
    assert.match(recurring, /Nội dung/);
    assert.match(recurring, /Thêm tệp/);
    assert.match(recurring, /type="time"/);
    assert.doesNotMatch(recurring, /type="datetime-local"/);
    const { default: Attachments } = await server.ssrLoadModule('/src/components/announcement/AnnouncementAttachments.jsx');
    const existing = [{ id: 7, fileName: 'lich-hop.pdf', sizeBytes: 1024 }];
    const selected = renderToStaticMarkup(
      React.createElement(Attachments, {
        existing,
        keepIds: [7],
        files: [{ name: 'noi-dung.png', size: 2048 }],
        onKeepChange: () => {},
        onFilesChange: () => {},
      }),
    );
    assert.match(selected, /2\/5 tệp đã chọn/);
    assert.match(selected, /lich-hop.pdf/);
    assert.match(selected, /noi-dung.png/);
    assert.match(selected, /Chờ tải lên/);
    assert.match(selected, /aria-label="Bỏ tệp noi-dung.png"/);
    const readOnly = renderToStaticMarkup(React.createElement(Attachments, { existing, readOnly: true }));
    assert.match(readOnly, /Tải tệp/);
    assert.doesNotMatch(readOnly, /type="file"|Thêm tệp|Bỏ tệp/);
    const pages = [
      ['/src/pages/NotificationsPage.jsx', '/notifications', '/notifications'],
      ['/src/pages/account/NotificationDetailPage.jsx', '/notifications/:id', '/notifications/1'],
      ['/src/pages/announcement/AnnouncementsPage.jsx', '/announcements', '/announcements'],
      ['/src/pages/announcement/AnnouncementEditPage.jsx', '/announcements/new', '/announcements/new'],
      ['/src/pages/announcement/AnnouncementEditPage.jsx', '/announcements/:id/edit', '/announcements/1/edit'],
      ['/src/pages/announcement/AnnouncementDetailPage.jsx', '/announcements/:id', '/announcements/1'],
      ['/src/pages/announcement/AnnouncementTemplatesPage.jsx', '/announcement-templates', '/announcement-templates'],
      ['/src/pages/announcement/NotificationRulesPage.jsx', '/notification-rules', '/notification-rules'],
      ['/src/pages/announcement/AnnouncementSchedulesPage.jsx', '/announcement-schedules', '/announcement-schedules'],
      ['/src/pages/announcement/AnnouncementScheduleEditPage.jsx', '/announcement-schedules/new', '/announcement-schedules/new'],
      ['/src/pages/announcement/AnnouncementScheduleEditPage.jsx', '/announcement-schedules/:id/edit', '/announcement-schedules/1/edit'],
    ];
    for (const [module, path, url] of pages) {
      const { default: Page } = await server.ssrLoadModule(module);
      const page = renderToStaticMarkup(
        React.createElement(
          MemoryRouter,
          { initialEntries: [url] },
          React.createElement(
            AuthProvider,
            null,
            React.createElement(Routes, null, React.createElement(Route, { path, element: React.createElement(Page) })),
          ),
        ),
      );
      assert.equal((page.match(/class="[^"]*\bpage-toolbar\b/g) || []).length, 1, `${url}: một header dùng chung`);
      assert.doesNotMatch(page, /class="page-actions"/, `${url}: không lặp nút cuối trang`);
      assert.doesNotMatch(page, />Bỏ chọn<|Tick các thông báo đã hủy cần xóa/, `${url}: chọn bằng checkbox`);
    }
  } finally {
    await server.close();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

const draft = (overrides = {}) => ({
  title: 'Thông báo họp',
  body: 'Nội dung họp',
  target: { scopeType: 'SCHOOL', roles: ['TEACHER'] },
  sendAt: '',
  keepIds: [],
  files: [],
  ...overrides,
});

test('chọn tệp và gửi dùng cùng giới hạn: tính cả tệp cũ, kích thước và định dạng', () => {
  const pdf = { name: 'tai-lieu.pdf', size: 10 * 1024 * 1024 };
  assert.doesNotThrow(() => validateAnnouncementFiles([pdf], [1, 2, 3, 4]));
  assert.throws(() => validateAnnouncementFiles([pdf], [1, 2, 3, 4, 5]), /Tối đa 5/);
  assert.throws(() => validateAnnouncementFiles([{ ...pdf, size: pdf.size + 1 }]), /10 MB/);
  assert.throws(() => validateAnnouncementFiles([{ name: 'tai-lieu.exe', size: 1 }]), /JPG, PNG hoặc PDF/);
});

test('bấm gửi tự xem trước người nhận, chuẩn bị dữ liệu xác nhận mà không cần xem trước thủ công', async () => {
  const input = draft();
  const calls = [];
  const gate = createPreviewCoordinator(async (target) => {
    calls.push(target);
    return { total: 3, byRole: { TEACHER: 3 } };
  });
  const result = await prepareAnnouncementSubmission(input, gate);
  assert.deepEqual(calls, [input.target]);
  assert.equal(result.preview.total, 3);
  assert.deepEqual(result.data, {
    title: input.title,
    body: input.body,
    target: input.target,
    sendAt: null,
    keepAttachmentIds: [],
  });
});

test('chưa chọn vai trò thì báo lỗi rõ, không gọi API preview', async () => {
  const gate = createPreviewCoordinator(() => assert.fail('Không được gọi preview'));
  await assert.rejects(
    prepareAnnouncementSubmission(draft({ target: { scopeType: 'SCHOOL', roles: [] } }), gate),
    /chọn ít nhất một vai trò/,
  );
});

test('nhóm trống hoặc API lỗi không chuẩn bị xác nhận gửi', async () => {
  await assert.rejects(
    prepareAnnouncementSubmission(
      draft(),
      createPreviewCoordinator(async () => ({ total: 0 })),
    ),
    /Không có người nhận/,
  );
  const failure = new Error('Không tải được người nhận');
  await assert.rejects(
    prepareAnnouncementSubmission(
      draft(),
      createPreviewCoordinator(async () => {
        throw failure;
      }),
    ),
    (error) => error === failure,
  );
});

test('đổi nhóm khi đang kiểm tra thì bỏ kết quả cũ, không mở xác nhận gửi', async () => {
  let resolve;
  const gate = createPreviewCoordinator(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const result = prepareAnnouncementSubmission(draft(), gate);
  gate.invalidate();
  resolve({ total: 8 });
  assert.equal(await result, null);
});

test('hẹn giờ giữ múi giờ Việt Nam và danh sách tệp hiện có', async () => {
  const result = await prepareAnnouncementSubmission(
    draft({ sendAt: '2026-12-01T08:30', keepIds: [4] }),
    createPreviewCoordinator(async () => ({ total: 1 })),
  );
  assert.equal(result.data.sendAt, '2026-12-01T01:30:00.000Z');
  assert.deepEqual(result.data.keepAttachmentIds, [4]);
});

test('tệp không hợp lệ bị chặn trước khi gọi preview', async () => {
  const gate = createPreviewCoordinator(() => assert.fail('Không được gọi preview'));
  await assert.rejects(prepareAnnouncementSubmission(draft({ files: [{ name: 'file.exe', size: 10 }] }), gate), /JPG, PNG hoặc PDF/);
  await assert.rejects(prepareAnnouncementSubmission(draft({ keepIds: [1, 2, 3, 4, 5, 6] }), gate), /Tối đa 5/);
});

test('preview cũ không bật gửi khi người dùng đổi đối tượng hoặc preview mới', async () => {
  const pending = [];
  const gate = createPreviewCoordinator((target, options) => new Promise((resolve) => pending.push({ target, options, resolve })));
  const first = gate.run({ scopeType: 'SCHOOL' });
  gate.invalidate();
  assert.equal(pending[0].options.signal.aborted, true);
  const second = gate.run({ scopeType: 'CLASSROOM' });
  pending[0].resolve({ total: 20 });
  pending[1].resolve({ total: 0 });
  assert.equal(await first, null);
  assert.deepEqual(await second, { total: 0 });
});
