import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { formatCount, insertAtCaret, renderSample } from '../../src/utils/announcement/templateText.mjs';

test('xem trước quy tắc thay biến đã biết bằng giá trị mẫu và giữ nguyên biến lạ', () => {
  assert.equal(renderSample('{tenTre} đã được đón lúc {gio} ngày {ngay}'), 'Bé An Nhiên đã được đón lúc 16:30 ngày 21/11/2026');
  assert.equal(renderSample('Xin chào {username}'), 'Xin chào {username}');
  assert.equal(renderSample(undefined), '');
});

test('chèn biến đúng chỗ con trỏ, thay đoạn đang chọn, và từ chối khi vượt giới hạn', () => {
  assert.deepEqual(insertAtCaret('Xin chào .', 9, 9, '{tenTre}', 100), { value: 'Xin chào {tenTre}.', caret: 17 });
  assert.deepEqual(insertAtCaret('Xin chào ABC.', 9, 12, '{ngay}', 100), { value: 'Xin chào {ngay}.', caret: 15 });
  assert.deepEqual(insertAtCaret('abc', undefined, undefined, '{lop}', 100), { value: 'abc{lop}', caret: 8 });
  assert.equal(insertAtCaret('abcdef', 3, 3, '{tenTre}', 10), null);
});

test('bộ đếm ký tự dùng dấu chấm ngăn nghìn', () => {
  assert.equal(formatCount('', 4000), '0 / 4.000');
  assert.equal(formatCount('abc', 150), '3 / 150');
});

test('form mẫu: hai cột có xem trước, đếm ký tự, xem trước đổi theo chữ đã nhập', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = new EventTarget();
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  try {
    const { default: Form } = await server.ssrLoadModule('/src/components/announcement/AnnouncementTemplateForm.jsx');
    const render = (form, extra = {}) =>
      renderToStaticMarkup(
        React.createElement(Form, {
          id: 'f',
          form,
          onChange: () => {},
          onSubmit: () => {},
          disabled: false,
          campuses: [{ id: 1, name: 'Điểm trường 1' }],
          viceRole: false,
          error: '',
          ...extra,
        }),
      );
    const empty = render({ name: '', title: '', body: '', campusId: null });
    assert.match(empty, /class="announcement-template-layout"/);
    assert.match(empty, /aria-label="Xem trước thông báo"/);
    assert.match(empty, /Chưa có tiêu đề/);
    assert.match(empty, /Chưa có nội dung/);
    assert.match(empty, /0 \/ 150/);
    assert.match(empty, /0 \/ 4\.000/);
    assert.match(empty, /Toàn trường/);
    const filled = render({ name: 'Nhắc họp', title: 'Họp phụ huynh', body: 'Dòng 1\nDòng 2', campusId: 1 });
    assert.match(filled, /<strong[^>]*>Họp phụ huynh<\/strong>/);
    assert.match(filled, /Dòng 1\nDòng 2/);
    assert.match(filled, /13 \/ 150/);
    assert.doesNotMatch(filled, /Chưa có tiêu đề/);
    assert.match(render({ name: '', title: '', body: '', campusId: null }, { viceRole: true }), /Chọn điểm trường/);
    assert.match(render({ name: '', title: '', body: '', campusId: null }, { error: 'Lỗi lưu mẫu' }), /Lỗi lưu mẫu/);
  } finally {
    await server.close();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('modal mẫu rộng cỡ xl; modal quy tắc có chip chèn biến và xem trước; lưu mẫu mang bodyHtml', () => {
  const templates = readFileSync('src/pages/announcement/AnnouncementTemplatesPage.jsx', 'utf8');
  assert.match(templates, /size="xl"/);
  assert.match(templates, /<AnnouncementTemplateForm/);
  assert.match(templates, /announcements\.createTemplate\(payload, user\)/);
  assert.match(templates, /announcements\.updateTemplate\(id, payload, user\)/);
  assert.match(templates, /body: form\.bodyHtml \? '' : form\.body/);
  const rules = readFileSync('src/pages/announcement/NotificationRulesPage.jsx', 'utf8');
  assert.match(rules, /Chèn biến \$\{variable\}/);
  assert.match(rules, /<AnnouncementPreview/);
  assert.match(rules, /renderSample\(form\.titleTemplate\)/);
});
