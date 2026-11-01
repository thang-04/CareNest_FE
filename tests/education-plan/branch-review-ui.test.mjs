import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const source = await readFile(new URL('../../src/components/education-plan/reviewUi.jsx', import.meta.url), 'utf8');
const isolated = source.replace(/^import .*;\r?\n/gm, '');
const stubs = `import React, {useState} from 'react'; const Check = () => null, Send = () => null, Undo2 = () => null; const Card=()=>null, Field=()=>null, History=()=>null, Modal=()=>null, Notice=()=>null, fmtDateTime=()=>'';\n`;
const { code } = await transformWithOxc(stubs + isolated, 'reviewUi.jsx', { lang: 'jsx', jsx: { runtime: 'classic' } });
const { ReviewActions } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString('base64')}`
);
const render = (props) => renderToStaticMarkup(React.createElement(ReviewActions, { name: 'nhánh', sendTo: 'Tổ trưởng', ...props }));
test('showSend mặc định false giữ caller cũ; nhánh luôn hiện và giải thích quyền thiếu', () => {
  assert.equal(render({ can: {} }), '');
  const html = render({ can: {}, showSend: true, sendDisabledReason: 'Chỉ được xem' });
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-description="Chỉ được xem"/);
  assert.match(html, /Gửi Tổ trưởng duyệt/);
});
test('send giữ người nhận và khóa vì chưa lưu, không đổi nút duyệt trả lại', () => {
  assert.doesNotMatch(render({ can: { send: true } }), /disabled/);
  const html = render({ can: { send: true, approve: true, reject: true }, sendBlocked: 'Lưu trước khi gửi' });
  assert.match(html, /title="Lưu trước khi gửi"/);
  assert.match(html, /Trả lại/);
  assert.match(html, /Duyệt/);
});
