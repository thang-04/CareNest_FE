import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformWithOxc } from 'vite';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyDeclaration } from '@/utils/children/childrenHelpers';

const source = await readFile(new URL('../../src/components/children/HealthDeclarationFields.jsx', import.meta.url), 'utf8');
// Checkbox stub ghi lại props để test gọi onChange (renderToStaticMarkup không bắn được sự kiện).
const stubs = `import React, { useId, useState } from 'react';
const Plus=()=>null,X=()=>null;
const FormField=({children})=>children;
const IntakeSheet=({title,children})=>React.createElement('div',null,React.createElement('h2',null,title),children);
const IntakeChoiceRow=({label,children})=>React.createElement('div',null,label,children);
const Checkbox=(props)=>{globalThis.__checkbox=props;return React.createElement('input',{type:'checkbox',checked:props.checked,readOnly:true,'aria-describedby':props['aria-describedby']});};
const ALLERGY_STATE_LABELS={},DIET_STATE_LABELS={},NOTE_STATE_LABELS={},MEDICAL_HISTORY_STATE_LABELS={};
const DECLARATION_STATE={REPORTED:'REPORTED',NONE_REPORTED:'NONE_REPORTED',NOT_PROVIDED:'NOT_PROVIDED'};
const MEDICAL_HISTORY_ITEMS=[{key:'self',label:'Tiền sử bản thân'}];
const emptyMedicalHistory=()=>({self:{state:null,text:'',contactDate:''}});
const todayInput=()=>'2026-11-18';
`;
const { code } = await transformWithOxc(stubs + source.replace(/^import .*;\r?\n/gm, ''), 'HealthDeclarationFields.jsx', {
  lang: 'jsx',
  jsx: { runtime: 'classic' },
});
const { HealthDeclarationFields } = await import(
  `data:text/javascript;base64,${Buffer.from(code.replace('from "react"', `from ${JSON.stringify(import.meta.resolve('react'))}`)).toString(
    'base64',
  )}`
);
const React = await import('react');

const declaration = (overrides = {}) => ({
  ...emptyDeclaration(),
  allergies: { state: 'REPORTED', items: ['Trứng'] },
  ...overrides,
});
const render = (props) => renderToStaticMarkup(React.createElement(HealthDeclarationFields, { onChange: () => {}, ...props }));

test('báo ăn: hiện bảng I và thông tin khác nằm ở bảng II', () => {
  const html = render({ value: declaration(), sheet: true });
  assert.match(html, /I\. Dị ứng và chế độ ăn/);
  assert.match(html, /Dị ứng thực phẩm \/ thuốc/);
  const bangII = html.indexOf('II. Tiền sử và sức khỏe khác');
  assert.ok(bangII > 0);
  assert.ok(html.indexOf('Thông tin sức khỏe khác', bangII) > bangII);
  assert.match(html, /Báo ăn/);
});

test('không báo ăn: ẩn dị ứng, chế độ ăn', () => {
  const html = render({ value: declaration({ mealRegistered: false }), sheet: true });
  assert.doesNotMatch(html, /Dị ứng thực phẩm \/ thuốc/);
  assert.doesNotMatch(html, /Chế độ ăn/);
  assert.match(html, /I\. Tiền sử và sức khỏe khác/);
  assert.match(html, /Thông tin sức khỏe khác/);
  assert.match(html, /Báo ăn/);
});

test('bỏ tích Báo ăn giữ nguyên dị ứng đã gõ', () => {
  const value = declaration();
  let received;
  render({ value, sheet: true, onChange: (next) => (received = next) });
  globalThis.__checkbox.onChange({ target: { checked: false } });
  assert.deepEqual(received, { ...value, mealRegistered: false });
  assert.deepEqual(received.allergies.items, ['Trứng']);
});

test('fieldset: không báo ăn ẩn dị ứng, chế độ ăn; thông tin khác nằm sau tiền sử', () => {
  const on = render({ value: declaration() });
  assert.match(on, /Dị ứng thực phẩm \/ thuốc/);
  assert.match(on, /Chế độ ăn/);
  const off = render({ value: declaration({ mealRegistered: false }) });
  assert.doesNotMatch(off, /Dị ứng thực phẩm \/ thuốc/);
  assert.doesNotMatch(off, /Chế độ ăn/);
  assert.ok(off.indexOf('Thông tin sức khỏe khác') > off.indexOf('Tiền sử bản thân'));
});

const HINT = 'Trẻ ăn ở trường. Bỏ tích: không khai dị ứng, chế độ ăn và trẻ không có suất ăn.';

for (const sheet of [true, false]) {
  test(`dòng gợi ý Báo ăn nối với ô tích bằng aria-describedby (sheet=${sheet})`, () => {
    const html = render({ value: declaration(), sheet });
    const id = html.match(/aria-describedby="([^"]+)"/)?.[1];
    assert.ok(id, 'ô tích có aria-describedby');
    assert.ok(html.includes(`<p id="${id}" class="field__hint">${HINT}</p>`), 'gợi ý mang đúng id và đúng câu chữ');
  });
}

test('fieldset: nhóm tiền sử gọi là Tiền sử và sức khỏe khác', () => {
  assert.match(render({ value: declaration() }), /<h3[^>]*>Tiền sử và sức khỏe khác<\/h3>/);
});
