import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';

// Màn Khai báo sức khỏe dạng bảng như bước 3 tiếp nhận (user duyệt canvas 19/11/2026).
const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

const source = await read('src/components/children/ChildBrief.jsx');
const stubs = `import React from 'react';
const ChildAvatar=({child})=>React.createElement('i',null,child.fullName);
const GENDER_LABELS={MALE:'Nam',FEMALE:'Nữ'};
const ageLabel=()=>'3 tuổi 8 tháng';
const formatDate=(v)=>v.split('-').reverse().join('/');
`;
const { code } = await transformWithOxc(stubs + source.replace(/^import .*;\r?\n/gm, ''), 'ChildBrief.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const { ChildBrief, ChildCardHead } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString(
    'base64',
  )}`
);
const React = await import('react');
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const child = { fullName: 'Trẻ mẫu', dateOfBirth: '2023-03-12', gender: 'MALE' };

test('thẻ trẻ: tên, ngày sinh, tuổi, giới tính', () => {
  const html = render(ChildBrief, { child });
  assert.match(html, /class="tr-child-brief"/);
  assert.match(html, /<span class="fw-600">Trẻ mẫu<\/span>/);
  assert.match(html, /12\/03\/2023 · 3 tuổi 8 tháng · Nam/);
});

test('thẻ trẻ: không rõ giới tính thì không thêm dấu chấm thừa', () => {
  assert.match(render(ChildBrief, { child: { ...child, gender: '' } }), /3 tuổi 8 tháng<\/span>/);
});

test('đầu thẻ: tên phần + thẻ trẻ; không có trẻ thì chỉ tên phần', () => {
  const html = render(ChildCardHead, { title: 'Báo ăn và sức khỏe', child });
  assert.match(html, /^<div class="tr-step-head"><h2 class="card__title">Báo ăn và sức khỏe<\/h2><div class="tr-child-brief">/);
  assert.doesNotMatch(render(ChildCardHead, { title: 'Thông tin tiếp nhận' }), /tr-child-brief/);
});

test('màn khai báo: sửa dùng bảng (sheet) dưới đầu thẻ tên trẻ; lý do thay đổi vẫn là thẻ riêng', async () => {
  const page = await read('src/pages/children/HealthDeclarationPage.jsx');
  assert.match(page, /<ChildCardHead title="Báo ăn và sức khỏe" child=\{child\} \/>\s*<HealthDeclarationFields\s+sheet\b/);
  assert.match(page, /<section className="card wizard-card">\s*<FormField label="Lý do thay đổi" required error=\{errors\.reason\}>/);
  assert.match(page, /<h2 className="card__title">Báo ăn và sức khỏe<\/h2>\s*<ChildBrief child=\{child\} \/>/);
});

test('tiếp nhận: đầu thẻ bước dùng chung ChildCardHead, không còn bản sao thẻ trẻ', async () => {
  const page = await read('src/pages/children/EnrollChildPage.jsx');
  assert.match(page, /<ChildCardHead/);
  assert.doesNotMatch(page, /tr-child-brief/);
});
